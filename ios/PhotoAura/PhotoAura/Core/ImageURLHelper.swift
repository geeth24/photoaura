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

    // The CDN's /fit-in/ variants resize the raw pixels and leave the EXIF
    // rotation flag on, so a portrait shot stored landscape comes back
    // 720x481 and only looks right because UIImage rotates it — at two
    // thirds the width we asked for. SIH's base64 "edits" form takes
    // rotate:null, which bakes the rotation in before resizing.
    //
    // Widths must match the warmer's EDIT_WIDTHS to hit the warmed cache,
    // and the JSON must serialise exactly like the web loader's
    // JSON.stringify — same key order, no spaces — or CloudFront keys differ.
    static func autoOriented(from urlString: String, width: Int) -> URL {
        let original = originalSize(from: urlString)
        guard let comps = URLComponents(url: original, resolvingAgainstBaseURL: false),
              let host = comps.host, host == cdnHost else { return original }
        let key = String(comps.path.dropFirst())
        guard !key.isEmpty else { return original }

        let json = #"{"bucket":"\#(bucket)","key":\#(jsonString(key)),"edits":{"rotate":null,"resize":{"width":\#(width),"fit":"inside"}}}"#
        let token = Data(json.utf8).base64EncodedString()
        return URL(string: "https://\(host)/\(token)") ?? original
    }

    private static let cdnHost = "aura-cdn.reactiveshots.com"
    private static let bucket = "photoaura"

    // the key travels inside JSON, so quote it the way JSON.stringify would —
    // without escaping slashes, or the base64 differs and every request misses
    // the warmed CloudFront entry
    private static func jsonString(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(
                withJSONObject: [value], options: [.withoutEscapingSlashes]),
              let arr = String(data: data, encoding: .utf8) else { return "\"\"" }
        return String(arr.dropFirst().dropLast())
    }
}
