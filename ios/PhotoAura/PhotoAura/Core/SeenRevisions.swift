//
//  SeenRevisions.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import Foundation

/// The newest revision the client has opened, per album, so the home can say
/// when a re-edit is waiting. Read with @AppStorage(SeenRevisions.key(slug)).
enum SeenRevisions {
    static func key(_ slug: String) -> String { "revisionSeen.\(slug)" }

    static func markSeen(_ number: Int, slug: String) {
        let defaults = UserDefaults.standard
        guard number > defaults.integer(forKey: key(slug)) else { return }
        defaults.set(number, forKey: key(slug))
    }
}
