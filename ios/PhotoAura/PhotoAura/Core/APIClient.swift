//
//  APIClient.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

enum APIError: LocalizedError {
    case badURL
    case badStatus(Int, String)
    case decoding(Error)
    case transport(Error)
    case noToken

    var errorDescription: String? {
        switch self {
        case .badURL:
            return "Bad request URL."
        case .badStatus(let code, let body):
            // raw HTML / huge bodies should never reach the UI — log them,
            // surface a short human message instead
            let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.hasPrefix("<") || trimmed.count > 200 {
                #if DEBUG
                print("APIError \(code) body: \(trimmed.prefix(500))")
                #endif
                return "Server returned \(code). Please try again."
            }
            if let data = trimmed.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let detail = json["detail"] as? String {
                return detail
            }
            return trimmed.isEmpty ? "Something went wrong (\(code))." : trimmed
        case .decoding:
            return "Couldn't read the server response."
        case .transport(let e):
            return e.localizedDescription
        case .noToken:
            return "Not signed in."
        }
    }
}

@Observable
final class APIClient {
    static let production = URL(string: "https://aura-api.reactiveshots.com/api")!

    var baseURL: URL
    private let decoder: JSONDecoder
    var token: String?

    init(baseURL: URL = APIClient.production) {
        self.baseURL = baseURL
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = d
    }

    func get<T: Decodable>(_ path: String, query: [String: String] = [:], requiresAuth: Bool = true) async throws -> T {
        try await send(path: path, query: query, method: "GET", body: Optional<Empty>.none, requiresAuth: requiresAuth)
    }

    func post<B: Encodable, T: Decodable>(_ path: String, body: B, requiresAuth: Bool = true) async throws -> T {
        try await send(path: path, query: [:], method: "POST", body: body, requiresAuth: requiresAuth)
    }

    func postVoid<B: Encodable>(_ path: String, body: B, requiresAuth: Bool = true) async throws {
        let _: Empty = try await send(path: path, query: [:], method: "POST", body: body, requiresAuth: requiresAuth)
    }

    func deleteVoid(_ path: String, requiresAuth: Bool = true) async throws {
        let _: Empty = try await send(path: path, query: [:], method: "DELETE", body: Optional<Empty>.none, requiresAuth: requiresAuth)
    }

    func patch<B: Encodable, T: Decodable>(_ path: String, body: B, requiresAuth: Bool = true) async throws -> T {
        try await send(path: path, query: [:], method: "PATCH", body: body, requiresAuth: requiresAuth)
    }

    private func buildURL(path: String, query: [String: String]) throws -> URL {
        // join base + path manually so existing trailing slashes / segments survive
        let joined = baseURL.absoluteString.trimmingCharacters(in: ["/"]) + "/" + path.trimmingPrefix("/")
        guard var comps = URLComponents(string: joined) else { throw APIError.badURL }
        if !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = comps.url else { throw APIError.badURL }
        return url
    }

    private func send<B: Encodable, T: Decodable>(
        path: String,
        query: [String: String],
        method: String,
        body: B?,
        requiresAuth: Bool
    ) async throws -> T {
        let url = try buildURL(path: path, query: query)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth {
            guard let token else { throw APIError.noToken }
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body, !(body is Empty) {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = resp as? HTTPURLResponse else {
            throw APIError.badStatus(0, "Bad response")
        }
        guard 200..<300 ~= http.statusCode else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError.badStatus(http.statusCode, body)
        }

        if T.self == Empty.self { return Empty() as! T }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

struct Empty: Codable {}

private extension String {
    func trimmingPrefix(_ p: String) -> String {
        hasPrefix(p) ? String(dropFirst(p.count)) : self
    }
}
