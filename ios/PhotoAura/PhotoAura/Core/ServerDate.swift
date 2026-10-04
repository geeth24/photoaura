//
//  ServerDate.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import Foundation

/// Dates arrive as strings; FastAPI sends naive datetimes ("2026-10-04T19:54:16.645415")
/// alongside proper ISO 8601 ones, so try both.
enum ServerDate {
    static func parse(_ s: String?) -> Date? {
        guard let s, !s.isEmpty else { return nil }
        for f in isoFormatters { if let d = f.date(from: s) { return d } }
        for f in naiveFormatters { if let d = f.date(from: s) { return d } }
        return nil
    }

    private static let isoFormatters: [ISO8601DateFormatter] = ([
        [.withInternetDateTime, .withFractionalSeconds],
        [.withInternetDateTime],
    ] as [ISO8601DateFormatter.Options]).map { opts in
        let f = ISO8601DateFormatter()
        f.formatOptions = opts
        return f
    }

    private static let naiveFormatters: [DateFormatter] = [
        "yyyy-MM-dd'T'HH:mm:ss.SSSSSS",
        "yyyy-MM-dd'T'HH:mm:ss",
    ].map { pattern in
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = pattern
        return f
    }
}
