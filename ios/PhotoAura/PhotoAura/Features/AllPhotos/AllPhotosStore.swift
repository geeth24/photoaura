//
//  AllPhotosStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation

@Observable
@MainActor
final class AllPhotosStore {
    private(set) var state = AllPhotosState()
    private let api: APIClient
    private let userId: Int

    init(api: APIClient, userId: Int) {
        self.api = api
        self.userId = userId
    }

    func send(_ intent: AllPhotosIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            state.error = nil
            let orientation = state.orientation.apiValue
            Task { [api, userId] in
                do {
                    let photos = try await api.allPhotos(userId: userId, orientation: orientation)
                    self.send(.loadSucceeded(photos))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }
        case .orientationChanged(let o):
            guard state.orientation != o else { return }
            state.orientation = o
            send(.load)
        case .loadSucceeded(let p):
            state.photos = p
            state.isLoading = false
            state.hasLoadedOnce = true
        case .loadFailed(let m):
            state.error = m
            state.isLoading = false
            state.hasLoadedOnce = true
        }
    }
}
