//
//  GalleriesStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

@Observable
@MainActor
final class GalleriesStore {
    private(set) var state = GalleriesState()
    private let api: APIClient
    private let userId: Int

    init(api: APIClient, userId: Int) {
        self.api = api
        self.userId = userId
    }

    func send(_ intent: GalleriesIntent) {
        switch intent {
        case .load:
            guard !state.isLoading else { return }
            state.isLoading = true
            state.error = nil
            Task { [api, userId] in
                do {
                    let albums = try await api.myAlbums(userId: userId)
                    self.send(.loadSucceeded(albums))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }
        case .refresh:
            send(.load)
        case .loadSucceeded(let albums):
            state.albums = albums
            state.isLoading = false
            state.hasLoadedOnce = true
        case .loadFailed(let m):
            state.error = m
            state.isLoading = false
            state.hasLoadedOnce = true
        }
    }
}
