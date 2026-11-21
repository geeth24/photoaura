//
//  AccessToken.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 11/21/26.
//

import Foundation

enum AccessToken {
    /// The `exp` claim of a JWT, read without verifying it. Nil for anything that isn't one.
    static func expiry(of jwt: String) -> Date? {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var b64 = parts[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        b64 += String(repeating: "=", count: (4 - b64.count % 4) % 4)
        guard let data = Data(base64Encoded: b64),
              let claims = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = claims["exp"] as? Double else { return nil }
        return Date(timeIntervalSince1970: exp)
    }
}
