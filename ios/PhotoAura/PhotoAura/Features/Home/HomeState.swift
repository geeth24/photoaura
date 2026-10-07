//
//  HomeState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 9/20/26.
//

import Foundation

struct HomeState {
    var summary: HomeSummary? = nil
    // something to sign or pay, else the next event
    var booking: MyBookingSummary? = nil
    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false
}

enum HomeIntent {
    case load
    case refresh
    case loadSucceeded(HomeSummary, MyBookingSummary?)
    case loadFailed(String)
}
