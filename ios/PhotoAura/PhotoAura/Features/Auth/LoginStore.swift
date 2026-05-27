//
//  LoginStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

@Observable
@MainActor
final class LoginStore {
    private(set) var state = LoginState()
    private let api: APIClient
    private let auth: AuthStore

    init(api: APIClient, auth: AuthStore) {
        self.api = api
        self.auth = auth
    }

    func send(_ intent: LoginIntent) {
        switch intent {
        case .modeChanged(let m):
            state.mode = m
            state.error = nil
            state.sentTo = nil

        case .emailChanged(let v):
            state.email = v
            state.error = nil

        case .usernameChanged(let v):
            state.username = v
            state.error = nil

        case .passwordChanged(let v):
            state.password = v
            state.error = nil

        case .submit:
            switch state.mode {
            case .magic: submitMagic()
            case .password: submitPassword()
            }

        case .magicLinkSent:
            state.isSending = false
            state.sentTo = state.email

        case .passwordSignedIn(let resp):
            state.isSending = false
            auth.signIn(token: resp.accessToken, user: resp.user)

        case .sendFailed(let m):
            state.isSending = false
            state.error = m

        case .dismissError:
            state.error = nil

        case .startOver:
            state.sentTo = nil
            state.error = nil
        }
    }

    private func submitMagic() {
        let target = state.email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !target.isEmpty else { return }
        state.isSending = true
        state.error = nil
        Task { [api, target] in
            do {
                try await api.requestMagicLink(email: target)
                self.send(.magicLinkSent)
            } catch {
                self.send(.sendFailed(error.localizedDescription))
            }
        }
    }

    private func submitPassword() {
        let u = state.username.trimmingCharacters(in: .whitespacesAndNewlines)
        let p = state.password
        guard !u.isEmpty, !p.isEmpty else { return }
        state.isSending = true
        state.error = nil
        Task { [api, u, p] in
            do {
                let resp = try await api.passwordLogin(username: u, password: p)
                self.send(.passwordSignedIn(resp))
            } catch {
                self.send(.sendFailed(error.localizedDescription))
            }
        }
    }
}
