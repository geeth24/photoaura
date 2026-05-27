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

    init(api: APIClient) {
        self.api = api
    }

    func send(_ intent: LoginIntent) {
        switch intent {
        case .emailChanged(let v):
            state.email = v
            state.error = nil

        case .submit:
            let target = state.email.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !target.isEmpty else { return }
            state.isSending = true
            state.error = nil
            Task { [api, target] in
                do {
                    try await api.requestMagicLink(email: target)
                    self.send(.sendSucceeded)
                } catch {
                    self.send(.sendFailed(error.localizedDescription))
                }
            }

        case .sendSucceeded:
            state.isSending = false
            state.sentTo = state.email

        case .sendFailed(let message):
            state.isSending = false
            state.error = message

        case .dismissError:
            state.error = nil

        case .startOver:
            state.sentTo = nil
            state.error = nil
        }
    }
}
