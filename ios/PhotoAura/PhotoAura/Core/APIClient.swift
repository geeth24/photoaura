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

    var statusCode: Int? {
        if case .badStatus(let code, _) = self { return code }
        return nil
    }

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
    let urlSession: URLSession
    private let now: () -> Date
    var token: String?

    // refresh state is plumbing, views don't read it
    @ObservationIgnored private(set) var refreshToken: String?
    // the refresh token only ever goes back to the server that issued it
    @ObservationIgnored private(set) var refreshBaseURL: URL?
    @ObservationIgnored private var refreshTask: Task<Void, Error>?
    @ObservationIgnored var onTokensRotated: ((_ access: String, _ refresh: String) -> Void)?
    @ObservationIgnored var onSessionExpired: (() -> Void)?

    init(baseURL: URL = APIClient.production, urlSession: URLSession = .shared, now: @escaping () -> Date = Date.init) {
        self.baseURL = baseURL
        self.urlSession = urlSession
        self.now = now
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = d
    }

    func get<T: Decodable>(_ path: String, query: [String: String] = [:], requiresAuth: Bool = true) async throws -> T {
        try await send(path: path, query: query, method: "GET", body: Optional<Empty>.none, requiresAuth: requiresAuth)
    }

    /// Raw bytes for PDFs and map images, which need the bearer token so can't go through AsyncImage.
    func data(_ path: String, queryItems: [URLQueryItem] = []) async throws -> Data {
        try await perform(path: path, queryItems: queryItems, method: "GET", body: Optional<Empty>.none, requiresAuth: true)
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

    func delete<T: Decodable>(_ path: String, requiresAuth: Bool = true) async throws -> T {
        try await send(path: path, query: [:], method: "DELETE", body: Optional<Empty>.none, requiresAuth: requiresAuth)
    }

    func patch<B: Encodable, T: Decodable>(_ path: String, body: B, requiresAuth: Bool = true) async throws -> T {
        try await send(path: path, query: [:], method: "PATCH", body: body, requiresAuth: requiresAuth)
    }

    func useRefreshToken(_ refresh: String, issuedBy base: URL) {
        refreshToken = refresh
        refreshBaseURL = base
    }

    func clearSession() {
        token = nil
        refreshToken = nil
        refreshBaseURL = nil
    }

    /// Swaps in a fresh access token when the current one is about to expire.
    func refreshIfNeeded() async {
        guard refreshToken != nil, let token,
              let exp = AccessToken.expiry(of: token),
              exp.timeIntervalSince(now()) < Self.refreshWindow else { return }
        try? await refresh(replacing: token)
    }

    func logout(refreshToken: String, base: URL) async {
        guard let url = try? buildURL(base: base, path: "/auth/logout", queryItems: []) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode(RefreshBody(refreshToken: refreshToken))
        _ = try? await urlSession.data(for: req)
    }

    private static let refreshWindow: TimeInterval = 5 * 60

    private struct RefreshBody: Encodable {
        let refreshToken: String
        enum CodingKeys: String, CodingKey { case refreshToken = "refresh_token" }
    }

    private struct RefreshResponse: Decodable {
        let accessToken: String
        let refreshToken: String
    }

    /// One refresh at a time. Callers that were rejected with `stale` wait on it,
    /// and skip it entirely if someone already swapped the token.
    private func refresh(replacing stale: String?) async throws {
        if let token, token != stale { return }
        if let refreshTask { return try await refreshTask.value }
        guard let refresh = refreshToken, let base = refreshBaseURL else { throw APIError.noToken }
        let task = Task { try await self.exchange(refresh, base: base) }
        refreshTask = task
        defer { refreshTask = nil }
        try await task.value
    }

    private func exchange(_ refresh: String, base: URL) async throws {
        var req = URLRequest(url: try buildURL(base: base, path: "/auth/refresh", queryItems: []))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(RefreshBody(refreshToken: refresh))

        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await urlSession.data(for: req)
        } catch {
            throw APIError.transport(error)
        }
        guard let http = resp as? HTTPURLResponse else {
            throw APIError.badStatus(0, "Bad response")
        }
        // signed out, or signed in again, while this was in flight
        guard refreshToken == refresh else { throw APIError.noToken }

        if http.statusCode == 401 {
            clearSession()
            onSessionExpired?()
            throw APIError.badStatus(401, String(data: data, encoding: .utf8) ?? "")
        }
        guard 200..<300 ~= http.statusCode else {
            throw APIError.badStatus(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        let rotated: RefreshResponse
        do {
            rotated = try decoder.decode(RefreshResponse.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
        token = rotated.accessToken
        refreshToken = rotated.refreshToken
        onTokensRotated?(rotated.accessToken, rotated.refreshToken)
    }

    private func buildURL(path: String, queryItems: [URLQueryItem]) throws -> URL {
        try buildURL(base: baseURL, path: path, queryItems: queryItems)
    }

    private func buildURL(base: URL, path: String, queryItems: [URLQueryItem]) throws -> URL {
        // join base + path manually so existing trailing slashes / segments survive
        let joined = base.absoluteString.trimmingCharacters(in: ["/"]) + "/" + path.trimmingPrefix("/")
        guard var comps = URLComponents(string: joined) else { throw APIError.badURL }
        if !queryItems.isEmpty {
            // addresses can hold & and +, which URLQueryItem leaves as-is
            comps.percentEncodedQueryItems = queryItems.map {
                URLQueryItem(name: $0.name, value: $0.value?.addingPercentEncoding(withAllowedCharacters: .queryValue))
            }
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
        let items = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        let data = try await perform(path: path, queryItems: items, method: method, body: body, requiresAuth: requiresAuth)

        if T.self == Empty.self, let empty = Empty() as? T { return empty }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func perform<B: Encodable>(
        path: String,
        queryItems: [URLQueryItem],
        method: String,
        body: B?,
        requiresAuth: Bool
    ) async throws -> Data {
        let url = try buildURL(path: path, queryItems: queryItems)
        let encoded: Data? = (body != nil && !(body is Empty)) ? try JSONEncoder().encode(body) : nil

        if requiresAuth { await refreshIfNeeded() }

        var (data, http, sent) = try await execute(url: url, method: method, body: encoded, requiresAuth: requiresAuth)
        if http.statusCode == 401, requiresAuth, refreshToken != nil {
            try await refresh(replacing: sent)
            (data, http, sent) = try await execute(url: url, method: method, body: encoded, requiresAuth: requiresAuth)
        }

        guard 200..<300 ~= http.statusCode else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError.badStatus(http.statusCode, body)
        }
        return data
    }

    private func execute(
        url: URL,
        method: String,
        body: Data?,
        requiresAuth: Bool
    ) async throws -> (Data, HTTPURLResponse, String?) {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let sent = token
        if requiresAuth {
            guard let sent else { throw APIError.noToken }
            req.setValue("Bearer \(sent)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body

        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await urlSession.data(for: req)
        } catch {
            throw APIError.transport(error)
        }
        guard let http = resp as? HTTPURLResponse else {
            throw APIError.badStatus(0, "Bad response")
        }
        return (data, http, sent)
    }
}

struct Empty: Codable {}

private extension CharacterSet {
    static let queryValue = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
}

private extension String {
    func trimmingPrefix(_ p: String) -> String {
        hasPrefix(p) ? String(dropFirst(p.count)) : self
    }
}
