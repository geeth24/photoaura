//
//  Endpoints.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//
//  Paths here mirror server/routers exactly — keep them in sync.
//  Plural `albums` = list; singular `album` = single by slug.
//

import Foundation

extension APIClient {
    struct RequestLinkBody: Encodable { let email: String }
    struct VerifyLinkBody: Encodable { let token: String }

    // POST /api/auth/request-link
    func requestMagicLink(email: String) async throws {
        try await postVoid("/auth/request-link", body: RequestLinkBody(email: email), requiresAuth: false)
    }

    // POST /api/auth/verify-link
    func verifyMagicLink(token: String) async throws -> AuthResponse {
        try await post("/auth/verify-link", body: VerifyLinkBody(token: token), requiresAuth: false)
    }

    // POST /api/login — username + password sign-in. Form-encoded
    // (FastAPI's OAuth2PasswordRequestForm), not JSON. Used as a fallback
    // for App Store reviewers and for repeat sign-in if a user prefers it
    // over the email magic-link round-trip.
    func passwordLogin(username: String, password: String) async throws -> AuthResponse {
        let url = baseURL.appendingPathComponent("login")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = "username=\(escape(username))&password=\(escape(password))"
        req.httpBody = body.data(using: .utf8)

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw APIError.badStatus(0, "Bad response")
        }
        guard 200..<300 ~= http.statusCode else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError.badStatus(http.statusCode, body)
        }
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return try d.decode(AuthResponse.self, from: data)
    }

    private func escape(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? s
    }

    // POST /api/verify-token  — auth required, returns 200 if token still valid
    func verifyToken() async throws {
        try await postVoid("/verify-token", body: Empty())
    }

    // PATCH /api/me — self-service username + full name updates
    struct UpdateMeBody: Encodable {
        let userName: String?
        let fullName: String?
        enum CodingKeys: String, CodingKey {
            case userName = "user_name"
            case fullName = "full_name"
        }
    }
    func updateMe(userName: String? = nil, fullName: String? = nil) async throws -> CurrentUser {
        let body = UpdateMeBody(userName: userName, fullName: fullName)
        return try await patch("/me", body: body)
    }

    // GET /api/albums/?user_id=N  — albums the user has permission to see
    func myAlbums(userId: Int) async throws -> [AlbumSummary] {
        try await get("/albums/", query: ["user_id": String(userId)])
    }

    // GET /api/album/{slug}/  — single album with photos
    func album(slug: String, orientation: String? = nil) async throws -> AlbumDetail {
        var q: [String: String] = [:]
        if let orientation { q["orientation"] = orientation }
        return try await get("/album/\(slug)/", query: q)
    }

    // GET /api/album/{slug}/faces  — people detected in this album
    func albumFaces(slug: String) async throws -> [FaceSummary] {
        try await get("/album/\(slug)/faces")
    }

    // GET /api/photos/?user_id=N[&orientation=…]
    func allPhotos(userId: Int, orientation: String? = nil) async throws -> [Photo] {
        var q: [String: String] = ["user_id": String(userId)]
        if let orientation { q["orientation"] = orientation }
        return try await get("/photos/", query: q)
    }

    // GET /api/album/{slug}/favorites — filenames this client starred
    struct FavoriteList: Decodable { let filenames: [String] }
    func favorites(slug: String) async throws -> [String] {
        let r: FavoriteList = try await get("/album/\(slug)/favorites")
        return r.filenames
    }

    // POST /api/album/{slug}/favorites — star or unstar one photo
    struct FavoriteBody: Encodable { let filename: String; let favorite: Bool }
    struct FavoriteResult: Decodable { let filename: String; let favorite: Bool }
    @discardableResult
    func setFavorite(slug: String, filename: String, favorite: Bool) async throws -> Bool {
        let r: FavoriteResult = try await post(
            "/album/\(slug)/favorites",
            body: FavoriteBody(filename: filename, favorite: favorite)
        )
        return r.favorite
    }

    // POST /api/album/{slug}/download-ticket — short-lived ticket for the zip
    struct DownloadTicket: Decodable { let ticket: String }
    func downloadTicket(slug: String) async throws -> String {
        let r: DownloadTicket = try await post("/album/\(slug)/download-ticket", body: [String: String]())
        return r.ticket
    }

    // GET /api/me/files — deliverable files (zips of originals etc.) with presigned URLs
    func myFiles() async throws -> [ClientFile] {
        try await get("/me/files")
    }

    // DELETE /api/me  — permanently deletes the signed-in account.
    // Apple App Store requires in-app account deletion (Guideline 5.1.1(v)).
    func deleteAccount() async throws {
        try await deleteVoid("/me")
    }
}
