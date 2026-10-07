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
    // what the list said, so downloads stay hidden before the album loads
    let initialLocked: Bool
    let isClient: Bool

    // a locked album's booking, and the final payment that unlocks it
    var lockBookingNumber: String? = nil
    var unlockAmountCents: Int? = nil

    var detail: AlbumDetail? = nil
    var faces: [FaceSummary] = []
    var selectedFaceId: String? = nil       // when set, photos are filtered
    var onlyRevised = false                 // just the latest revision's photos

    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false

    var revision: AlbumRevision? {
        guard let r = detail?.revision, r.number > 1 else { return nil }
        return r
    }

    var photos: [Photo] {
        guard let detail else { return [] }
        var result = detail.albumPhotos
        if let faceId = selectedFaceId, let face = faces.first(where: { $0.faceId == faceId }) {
            let allowed = Set(face.filenames)
            result = result.filter { allowed.contains($0.fileMetadata.filename) }
        }
        if onlyRevised, let number = revision?.number {
            result = result.filter { $0.fileMetadata.revisionNumber == number }
        }
        return result
    }

    // the server's count, or what we can see if it didn't send one
    var revisedCount: Int {
        guard let revision else { return 0 }
        if let n = revision.photoCount, n > 0 { return n }
        return detail?.albumPhotos.filter { $0.fileMetadata.revisionNumber == revision.number }.count ?? 0
    }

    var title: String { detail?.albumName ?? initialName }

    // proof mode: watermarked previews, and the server refuses originals and zips
    var isLocked: Bool { detail.map(\.isLocked) ?? initialLocked }
}

enum AlbumIntent {
    case load
    case refresh
    case selectFace(String?)
    case toggleOnlyRevised
    case loadSucceeded(AlbumDetail, [FaceSummary])
    case loadFailed(String)
    case lockInfoLoaded(bookingNumber: String?, amountCents: Int?)
}
