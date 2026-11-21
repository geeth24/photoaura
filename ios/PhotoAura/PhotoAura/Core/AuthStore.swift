//
//  AuthStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

@Observable
final class AuthStore {
    enum Status: Equatable {
        case checking
        case signedOut
        case signedIn(CurrentUser)
    }

    private let api: APIClient
    private let tokenKey = "auraToken"
    private let refreshKey = "auraRefreshToken"
    private let refreshBaseKey = "auraRefreshBase"
    private let userKey = "auraUser"
    private let defaults = UserDefaults.standard

    private(set) var status: Status = .checking

    init(api: APIClient) {
        self.api = api
        api.onTokensRotated = { [weak self] access, refresh in
            guard let self else { return }
            KeychainStore.save(access, for: tokenKey)
            KeychainStore.save(refresh, for: refreshKey)
        }
        api.onSessionExpired = { [weak self] in
            self?.signOut()
        }
    }

    // the scene came back to the foreground; top up the token before any request needs it
    func refreshIfNeeded() async {
        guard case .signedIn = status else { return }
        await api.refreshIfNeeded()
    }

    // restore from local storage immediately on launch; verify in background
    func bootstrap() async {
        guard let token = KeychainStore.read(tokenKey),
              let userData = defaults.data(forKey: userKey),
              let user = try? JSONDecoder().decode(CurrentUser.self, from: userData)
        else {
            status = .signedOut
            return
        }
        api.token = token
        if let refresh = KeychainStore.read(refreshKey),
           let base = KeychainStore.read(refreshBaseKey).flatMap(URL.init(string:)) {
            api.useRefreshToken(refresh, issuedBy: base)
        }
        status = .signedIn(user)

        // sanity-check the token in the background; if rejected, sign out
        Task { [api] in
            do {
                _ = try await api.verifyToken()
            } catch APIError.badStatus(let code, _) where code == 401 {
                await MainActor.run { self.signOut() }
            } catch {
                // network / other errors — keep the signed-in state
            }
        }
    }

    func signIn(_ resp: AuthResponse) {
        let user = resp.user
        api.token = resp.accessToken
        KeychainStore.save(resp.accessToken, for: tokenKey)
        if let refresh = resp.refreshToken {
            api.useRefreshToken(refresh, issuedBy: api.baseURL)
            KeychainStore.save(refresh, for: refreshKey)
            KeychainStore.save(api.baseURL.absoluteString, for: refreshBaseKey)
        } else {
            KeychainStore.delete(refreshKey)
            KeychainStore.delete(refreshBaseKey)
        }
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: userKey)
        }
        status = .signedIn(user)
    }

    // called after a successful profile edit so the avatar + nav reflect the new name
    func updateCurrentUser(_ user: CurrentUser) {
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: userKey)
        }
        status = .signedIn(user)
    }

    func signOut() {
        // revoke on the server that issued it, which may not be the selected studio anymore
        if let refresh = api.refreshToken, let base = api.refreshBaseURL {
            Task { [api] in await api.logout(refreshToken: refresh, base: base) }
        }
        KeychainStore.delete(tokenKey)
        KeychainStore.delete(refreshKey)
        KeychainStore.delete(refreshBaseKey)
        defaults.removeObject(forKey: userKey)
        api.clearSession()
        status = .signedOut
    }
}
