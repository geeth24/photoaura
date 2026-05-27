//
//  ProfileState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//
//  iOS profile is intentionally minimal — hero card, about, sign out, delete.
//  Email/account management lives on the web at aura.reactiveshots.com/profile.
//

import Foundation

struct ProfileState {
    var isDeletingAccount: Bool = false
    var deleteError: String? = nil
}

enum ProfileIntent {
    case signOut
    case deleteAccount
    case deleteFailed(String)
    case dismissDeleteError
}
