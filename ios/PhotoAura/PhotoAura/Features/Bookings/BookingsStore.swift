//
//  BookingsStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import Foundation

@Observable
@MainActor
final class BookingsStore {
    private(set) var state = BookingsState()
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func send(_ intent: BookingsIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            Task { [api] in
                do {
                    self.send(.loaded(try await api.myBookings()))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }
        case .loaded(let rows):
            state.bookings = rows
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = nil
        case .loadFailed(let message):
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = message
        }
    }
}
