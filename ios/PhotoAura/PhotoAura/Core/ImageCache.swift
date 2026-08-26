//
//  ImageCache.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 8/25/26.
//
//  AsyncImage always goes through a loading phase, even when the bytes are
//  already in URLCache, and renders its placeholder for that frame — which is
//  the black flash when a photo opens. This keeps decoded images around so a
//  thumbnail the grid already showed can be drawn on the very first frame.
//

import SwiftUI
import UIKit

enum ImageCache {
    private static let memory: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 240
        return c
    }()

    /// Non-blocking lookup: memory first, then already-downloaded bytes.
    static func cached(_ url: URL?) -> UIImage? {
        guard let url else { return nil }
        let key = url.absoluteString as NSString
        if let hit = memory.object(forKey: key) { return hit }
        // URLCache is a synchronous read; decoding a grid-sized thumbnail here
        // is cheaper than showing a blank frame
        guard let data = URLCache.shared.cachedResponse(for: URLRequest(url: url))?.data,
              let image = UIImage(data: data) else { return nil }
        memory.setObject(image, forKey: key)
        return image
    }

    static func store(_ image: UIImage, for url: URL?) {
        guard let url else { return }
        memory.setObject(image, forKey: url.absoluteString as NSString)
    }
}

/// Draws a cached image immediately when there is one, so opening a photo never
/// shows an empty frame; otherwise loads it and fades in.
struct CachedImage: View {
    let url: URL?
    var contentMode: ContentMode = .fit

    @State private var loaded: UIImage?

    init(url: URL?, contentMode: ContentMode = .fit) {
        self.url = url
        self.contentMode = contentMode
        _loaded = State(initialValue: ImageCache.cached(url))
    }

    var body: some View {
        Group {
            if let image = loaded {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else {
                Color.clear
            }
        }
        .task(id: url) {
            if loaded != nil { return }
            guard let url else { return }
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let image = UIImage(data: data) else { return }
            ImageCache.store(image, for: url)
            withAnimation(.easeOut(duration: 0.2)) { loaded = image }
        }
    }
}
