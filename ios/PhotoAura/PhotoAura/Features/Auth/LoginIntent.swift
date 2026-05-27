//
//  LoginIntent.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

enum LoginIntent {
    case modeChanged(LoginMode)
    case emailChanged(String)
    case usernameChanged(String)
    case passwordChanged(String)
    case submit
    case magicLinkSent
    case passwordSignedIn(AuthResponse)
    case sendFailed(String)
    case dismissError
    case startOver
}
