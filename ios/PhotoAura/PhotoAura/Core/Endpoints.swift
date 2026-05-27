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

    // POST /api/verify-token  — auth required, returns 200 if token still valid
    func verifyToken() async throws {
        try await postVoid("/verify-token", body: Empty())
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

    // DELETE /api/me  — permanently deletes the signed-in account.
    // Apple App Store requires in-app account deletion (Guideline 5.1.1(v)).
    func deleteAccount() async throws {
        try await deleteVoid("/me")
    }
}
