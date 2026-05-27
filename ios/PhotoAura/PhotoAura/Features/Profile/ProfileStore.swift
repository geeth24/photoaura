//
//  ProfileStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation

@Observable
@MainActor
final class ProfileStore {
    private(set) var state = ProfileState()
    private let api: APIClient
    private let auth: AuthStore

    init(api: APIClient, auth: AuthStore) {
        self.api = api
        self.auth = auth
    }

    func send(_ intent: ProfileIntent) {
        switch intent {
        case .signOut:
            auth.signOut()

        case .deleteAccount:
            guard !state.isDeletingAccount else { return }
            state.isDeletingAccount = true
            state.deleteError = nil
            Task { [api, auth] in
                do {
                    try await api.deleteAccount()
                    // local cleanup happens via signOut — keychain + cached user gone
                    auth.signOut()
                } catch {
                    self.send(.deleteFailed(error.localizedDescription))
                }
            }

        case .deleteFailed(let msg):
            state.isDeletingAccount = false
            state.deleteError = msg

        case .dismissDeleteError:
            state.deleteError = nil
        }
    }
}
