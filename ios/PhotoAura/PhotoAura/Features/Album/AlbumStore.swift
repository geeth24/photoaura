//
//  AlbumStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation

@Observable
@MainActor
final class AlbumStore {
    private(set) var state: AlbumState
    private let api: APIClient

    init(api: APIClient, slug: String, initialName: String, initialLocked: Bool = false, isClient: Bool = true) {
        self.api = api
        self.state = AlbumState(slug: slug, initialName: initialName, initialLocked: initialLocked, isClient: isClient)
    }

    func send(_ intent: AlbumIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            state.error = nil
            Task { [api, slug = state.slug] in
                do {
                    // fetch both in parallel; faces is allowed to fail (some albums don't have face detection)
                    async let detailTask = api.album(slug: slug)
                    async let facesTask = (try? await api.albumFaces(slug: slug)) ?? []
                    let detail = try await detailTask
                    let faces = await facesTask
                    self.send(.loadSucceeded(detail, faces))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }

        case .selectFace(let id):
            state.selectedFaceId = (state.selectedFaceId == id) ? nil : id

        case .toggleOnlyRevised:
            state.onlyRevised.toggle()

        case .loadSucceeded(let detail, let faces):
            state.detail = detail
            state.faces = faces
            state.isLoading = false
            state.hasLoadedOnce = true
            if state.revision == nil { state.onlyRevised = false }
            // opening the album is what clears "Revision N ready" on the home
            if let r = state.revision { SeenRevisions.markSeen(r.number, slug: state.slug) }
            if detail.isLocked {
                state.lockBookingNumber = state.lockBookingNumber ?? detail.bookingNumber
                if state.isClient { loadLockInfo(bookingNumber: detail.bookingNumber) }
            }

        case .loadFailed(let msg):
            state.error = msg
            state.isLoading = false
            state.hasLoadedOnce = true

        case .lockInfoLoaded(let number, let amount):
            if let number { state.lockBookingNumber = number }
            state.unlockAmountCents = amount
        }
    }

    // the album only says it's locked; the client's own booking knows what's left to pay
    private func loadLockInfo(bookingNumber: String?) {
        Task { [api, slug = state.slug] in
            guard let rows = try? await api.myBookings() else { return }
            guard let b = rows.first(where: { $0.number == bookingNumber || $0.albumSlug == slug }) else { return }
            let amount = b.nextPayment.flatMap { $0.isClosing ? $0.amountCents : nil }
            self.send(.lockInfoLoaded(bookingNumber: b.number, amountCents: amount))
        }
    }
}
