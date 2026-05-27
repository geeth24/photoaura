//
//  AlbumState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation

struct AlbumState {
    let slug: String
    let initialName: String

    var detail: AlbumDetail? = nil
    var faces: [FaceSummary] = []
    var selectedFaceId: String? = nil       // when set, photos are filtered

    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false

    var photos: [Photo] {
        guard let detail else { return [] }
        guard let faceId = selectedFaceId,
              let face = faces.first(where: { $0.faceId == faceId }) else {
            return detail.albumPhotos
        }
        let allowed = Set(face.filenames)
        return detail.albumPhotos.filter { allowed.contains($0.fileMetadata.filename) }
    }

    var title: String { detail?.albumName ?? initialName }
}

enum AlbumIntent {
    case load
    case refresh
    case selectFace(String?)
    case loadSucceeded(AlbumDetail, [FaceSummary])
    case loadFailed(String)
}
