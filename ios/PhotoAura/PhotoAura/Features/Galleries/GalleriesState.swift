//
//  GalleriesState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

struct GalleriesState {
    var albums: [AlbumSummary] = []
    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false
}

enum GalleriesIntent {
    case load
    case refresh
    case loadSucceeded([AlbumSummary])
    case loadFailed(String)
}
