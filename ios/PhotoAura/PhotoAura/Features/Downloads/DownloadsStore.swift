//
//  DownloadsStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 8/25/26.
//

import Foundation

@Observable
@MainActor
final class DownloadsStore {
    private(set) var state = DownloadsState()
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func send(_ intent: DownloadsIntent) {
        switch intent {
        case .load:
            guard !state.isLoading else { return }
            state.isLoading = true
            state.error = nil
            Task { [api] in
                do {
                    let files = try await api.myFiles()
                    self.send(.loadSucceeded(files))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }
        case .refresh:
            send(.load)
        case .loadSucceeded(let files):
            state.files = files
            state.isLoading = false
            state.hasLoadedOnce = true
        case .loadFailed(let m):
            state.error = m
            state.isLoading = false
            state.hasLoadedOnce = true
        }
    }
}
