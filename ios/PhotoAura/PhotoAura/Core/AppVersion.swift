//
//  AppVersion.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import Foundation

/// A dotted version compared number by number, so 2.10 sorts after 2.9 and
/// 2.3 equals 2.3.0.
struct AppVersion: Comparable, CustomStringConvertible {
    let parts: [Int]
    let description: String

    init?(_ string: String?) {
        guard let raw = string?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
        // "2.4b1" counts as 2.4; anything without a leading number is noise
        let parts = raw.split(separator: ".").map { Int($0.prefix(while: \.isNumber)) }
        guard let first = parts.first, first != nil else { return nil }
        self.parts = parts.map { $0 ?? 0 }
        self.description = raw
    }

    static var current: AppVersion? {
        AppVersion(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String)
    }

    static func < (a: AppVersion, b: AppVersion) -> Bool {
        for i in 0..<max(a.parts.count, b.parts.count) {
            let l = i < a.parts.count ? a.parts[i] : 0
            let r = i < b.parts.count ? b.parts[i] : 0
            if l != r { return l < r }
        }
        return false
    }

    static func == (a: AppVersion, b: AppVersion) -> Bool { !(a < b) && !(b < a) }
}
