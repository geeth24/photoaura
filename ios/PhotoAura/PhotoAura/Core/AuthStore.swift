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
    private let userKey = "auraUser"
    private let defaults = UserDefaults.standard

    private(set) var status: Status = .checking

    init(api: APIClient) {
        self.api = api
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

    func signIn(token: String, user: CurrentUser) {
        api.token = token
        KeychainStore.save(token, for: tokenKey)
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: userKey)
        }
        status = .signedIn(user)
    }

    func signOut() {
        KeychainStore.delete(tokenKey)
        defaults.removeObject(forKey: userKey)
        api.token = nil
        status = .signedOut
    }
}
