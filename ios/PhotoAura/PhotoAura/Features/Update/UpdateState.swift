//
//  UpdateState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import Foundation

struct UpdateState {
    enum Prompt: Equatable {
        case required(UpdatePolicy)
        case suggested(UpdatePolicy)
    }

    var prompt: Prompt? = nil
    var checking = false
    var lastChecked: Date? = nil
}

enum UpdateIntent {
    case appBecameActive
    case checked(UpdatePolicy?)
    case checkFailed
    case dismissSuggestion
    case openStore
}
