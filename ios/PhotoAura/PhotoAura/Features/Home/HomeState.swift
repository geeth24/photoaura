//
//  HomeState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 9/20/26.
//

import Foundation

struct HomeState {
    var summary: HomeSummary? = nil
    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false
}

enum HomeIntent {
    case load
    case refresh
    case loadSucceeded(HomeSummary)
    case loadFailed(String)
}
