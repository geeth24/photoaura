//
//  DeepLink.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

enum DeepLink {
    // accepts either:
    //   universal link  https://aura.reactiveshots.com/auth/verify?token=…
    //   custom scheme   aura://verify?token=…
    static func handle(_ url: URL, auth: AuthStore, api: APIClient) {
        guard let token = extractToken(from: url) else { return }
        Task {
            do {
                let resp = try await api.verifyMagicLink(token: token)
                await MainActor.run {
                    auth.signIn(token: resp.accessToken, user: resp.user)
                }
            } catch {
                // failed verify just leaves user signed-out; login screen handles it
            }
        }
    }

    private static func extractToken(from url: URL) -> String? {
        guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }

        let isUniversalVerify =
            (comps.scheme == "https" || comps.scheme == "http") &&
            comps.host == "aura.reactiveshots.com" &&
            comps.path.hasPrefix("/auth/verify")

        let isCustomVerify =
            comps.scheme == "aura" &&
            comps.host == "verify"

        guard isUniversalVerify || isCustomVerify else { return nil }

        return comps.queryItems?.first(where: { $0.name == "token" })?.value
    }
}
