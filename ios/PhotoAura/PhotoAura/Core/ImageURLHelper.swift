//
//  ImageURLHelper.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation

enum ImageURLHelper {
    // The CDN serves resized variants via a thumbor-style prefix:
    //   https://aura-cdn.reactiveshots.com/fit-in/1920x0/{slug}/{file}
    // The same path without that prefix is the original full-resolution file.
    // Presigned S3 URLs (videos) don't follow this pattern — they're returned
    // as-is so they still work.
    static func originalSize(from urlString: String) -> URL {
        guard let url = URL(string: urlString) else {
            return URL(string: urlString) ?? URL(string: "about:blank")!
        }
        let path = url.path
        // matches "/fit-in/<digits>x<digits>/" at the start
        let pattern = #"^/fit-in/\d+x\d+/"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: path, range: NSRange(path.startIndex..., in: path)),
              let matchRange = Range(match.range, in: path) else {
            return url
        }
        var comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        comps?.path = "/" + String(path[matchRange.upperBound...])
        return comps?.url ?? url
    }

    // A web-optimized copy: full frame resized to ~2560px. Stills only — don't
    // call for videos (presigned URLs have no fit-in prefix to swap).
    static func optimizedSize(from urlString: String, width: Int = 2560) -> URL {
        let original = originalSize(from: urlString)
        guard var comps = URLComponents(url: original, resolvingAgainstBaseURL: false) else {
            return original
        }
        comps.path = "/fit-in/\(width)x0" + comps.path
        return comps.url ?? original
    }
}
