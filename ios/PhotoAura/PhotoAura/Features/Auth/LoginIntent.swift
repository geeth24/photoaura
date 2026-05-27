//
//  LoginIntent.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

enum LoginIntent {
    case emailChanged(String)
    case submit
    case sendSucceeded
    case sendFailed(String)
    case dismissError
    case startOver
}
