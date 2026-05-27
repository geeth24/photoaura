//
//  AllPhotosState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation

enum OrientationFilter: String, CaseIterable, Hashable {
    case all
    case portrait
    case landscape

    var label: String {
        switch self {
        case .all: return "All"
        case .portrait: return "Portrait"
        case .landscape: return "Landscape"
        }
    }

    var apiValue: String? {
        switch self {
        case .all: return nil
        case .portrait: return "portrait"
        case .landscape: return "landscape"
        }
    }
}

struct AllPhotosState {
    var photos: [Photo] = []
    var orientation: OrientationFilter = .all
    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false
}

enum AllPhotosIntent {
    case load
    case refresh
    case orientationChanged(OrientationFilter)
    case loadSucceeded([Photo])
    case loadFailed(String)
}
