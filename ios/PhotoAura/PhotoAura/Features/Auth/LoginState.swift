//
//  LoginState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import Foundation

struct LoginState {
    var email: String = ""
    var isSending: Bool = false
    var sentTo: String? = nil       // when set, show "check your inbox" UI
    var error: String? = nil
}
