//
//  PhotoVersionsStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import Foundation

struct PhotoVersionsState {
    let photoId: Int
    let currentVersion: Int
    var versions: [PhotoVersion] = []
    var selectedVersion: Int? = nil
    var isLoading = false
    var failed = false

    // earlier edits there's something to look at for, oldest first
    var earlier: [PhotoVersion] {
        versions.filter { $0.version < currentVersion && $0.compressedImage != nil }
    }

    // what the compare view puts against the current photo; the edit just before it by default
    var compareTo: PhotoVersion? {
        earlier.first { $0.version == selectedVersion } ?? earlier.last
    }
}

enum PhotoVersionsIntent {
    case load
    case select(Int)
    case loaded([PhotoVersion])
    case loadFailed
}

@Observable
@MainActor
final class PhotoVersionsStore {
    private(set) var state: PhotoVersionsState
    private let api: APIClient

    init(api: APIClient, photoId: Int, currentVersion: Int) {
        self.api = api
        self.state = PhotoVersionsState(photoId: photoId, currentVersion: currentVersion)
    }

    func send(_ intent: PhotoVersionsIntent) {
        switch intent {
        case .load:
            guard !state.isLoading, state.versions.isEmpty else { return }
            state.isLoading = true
            state.failed = false
            Task { [api, id = state.photoId] in
                do {
                    self.send(.loaded(try await api.photoVersions(photoId: id)))
                } catch {
                    self.send(.loadFailed)
                }
            }
        case .select(let version):
            state.selectedVersion = version
        case .loaded(let versions):
            state.versions = versions.sorted { $0.version < $1.version }
            state.isLoading = false
        case .loadFailed:
            state.isLoading = false
            state.failed = true
        }
    }
}
