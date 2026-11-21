//
//  AlbumState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation

/// Which cut of the album the grid shows.
enum AlbumScope: Hashable {
    case highlights, all, moments

    var title: String {
        switch self {
        case .highlights: "Highlights"
        case .all: "All"
        case .moments: "Moments"
        }
    }
}

/// One moment with the album photos it covers, in capture order.
struct MomentGroup: Identifiable {
    let moment: AlbumMoment
    let photos: [Photo]
    var id: String { moment.id }
}

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
    var chosenScope: AlbumScope? = nil
    // worked out once per load from the album's smart fields
    var highlightNames: Set<String> = []
    var momentGroups: [MomentGroup] = []

    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false

    var revision: AlbumRevision? {
        guard let r = detail?.revision, r.number > 1 else { return nil }
        return r
    }

    // the highlights chip leads when there are any, and moments only join them
    var scopes: [AlbumScope] {
        if highlightNames.isEmpty && momentGroups.isEmpty { return [.all] }
        return (highlightNames.isEmpty ? [] : [.highlights]) + [.all] + (momentGroups.isEmpty ? [] : [.moments])
    }

    var showsScopes: Bool { scopes.count > 1 }

    var scope: AlbumScope {
        if let chosenScope, scopes.contains(chosenScope) { return chosenScope }
        return highlightNames.isEmpty ? .all : .highlights
    }

    // face and revision filters over the whole album, whatever the scope
    var filteredPhotos: [Photo] {
        guard let detail else { return [] }
        return applyFilters(to: detail.albumPhotos)
    }

    // what the grid and the viewer step through
    var photos: [Photo] {
        switch scope {
        case .all: filteredPhotos
        case .highlights: filteredPhotos.filter { highlightNames.contains($0.fileMetadata.filename) }
        case .moments: visibleMoments.flatMap(\.photos)
        }
    }

    var visibleMoments: [MomentGroup] {
        momentGroups.compactMap { group in
            let kept = applyFilters(to: group.photos)
            return kept.isEmpty ? nil : MomentGroup(moment: group.moment, photos: kept)
        }
    }

    private func applyFilters(to photos: [Photo]) -> [Photo] {
        var result = photos
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
    case selectScope(AlbumScope)
    case loadSucceeded(AlbumDetail, [FaceSummary])
    case loadFailed(String)
    case lockInfoLoaded(bookingNumber: String?, amountCents: Int?)
}
