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

    init(api: APIClient, slug: String, initialName: String) {
        self.api = api
        self.state = AlbumState(slug: slug, initialName: initialName)
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

        case .loadSucceeded(let detail, let faces):
            state.detail = detail
            state.faces = faces
            state.isLoading = false
            state.hasLoadedOnce = true

        case .loadFailed(let msg):
            state.error = msg
            state.isLoading = false
            state.hasLoadedOnce = true
        }
    }
}
