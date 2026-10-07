//
//  HomeStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 9/20/26.
//

import Foundation

@Observable
@MainActor
final class HomeStore {
    private(set) var state = HomeState()
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func send(_ intent: HomeIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            state.error = nil
            Task { [api] in
                // older servers have no bookings; home still works without them
                async let bookings = try? await api.myBookings()
                do {
                    let summary = try await api.home()
                    self.send(.loadSucceeded(summary, await bookings?.homeBooking))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }
        case .loadSucceeded(let summary, let booking):
            state.summary = summary
            state.booking = booking
            state.isLoading = false
            state.hasLoadedOnce = true
        case .loadFailed(let m):
            state.error = m
            state.isLoading = false
            state.hasLoadedOnce = true
        }
    }
}
