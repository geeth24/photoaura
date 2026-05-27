//
//  LoginState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

enum LoginMode: Hashable {
    case magic
    case password
}

struct LoginState {
    var mode: LoginMode = .magic

    // magic-link inputs
    var email: String = ""
    var sentTo: String? = nil       // when set, show "check your inbox" UI

    // password inputs
    var username: String = ""
    var password: String = ""

    var isSending: Bool = false
    var error: String? = nil
}
