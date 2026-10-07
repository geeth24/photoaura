//
//  AdminBookingsStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import Foundation

@Observable
@MainActor
final class AdminBookingsStore {
    private(set) var state = AdminBookingsState()
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func send(_ intent: AdminBookingsIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            // the counts on every chip need the whole list, so filter here rather than on the server
            Task { [api] in
                do {
                    self.send(.loaded(try await api.bookings()))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }
        case .loaded(let rows):
            state.rows = rows
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = nil
        case .loadFailed(let message):
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = message
        case .setFilter(let f):
            state.filter = f
        }
    }
}
