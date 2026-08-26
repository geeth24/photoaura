//
//  DownloadsState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 8/25/26.
//

import Foundation

struct DownloadsState {
    var files: [ClientFile] = []
    var isLoading: Bool = false
    var error: String? = nil
    var hasLoadedOnce: Bool = false
}

enum DownloadsIntent {
    case load
    case refresh
    case loadSucceeded([ClientFile])
    case loadFailed(String)
}
