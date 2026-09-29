//
//  Models.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//
//  Shapes here mirror the JSON the backend actually returns.
//  `keyDecodingStrategy = .convertFromSnakeCase` is on, so
//  `album_id` → `albumId` automatically.
//

import Foundation

struct CurrentUser: Codable, Hashable {
    let id: Int
    let userName: String?
    let fullName: String
    let userEmail: String
    let role: String?
}

struct AuthResponse: Decodable {
    let accessToken: String
    let user: CurrentUser
}

// GET /api/albums/ — list of albums (has album_id, plus inline photos)
struct AlbumSummary: Codable, Hashable, Identifiable {
    let albumId: Int
    let albumName: String
    let slug: String
    let imageCount: Int
    let albumPhotos: [Photo]?

    var id: Int { albumId }
    var coverImage: String? { albumPhotos?.first?.compressedImage }
}

// GET /api/album/{slug}/ — single album detail (no album_id in response)
struct AlbumDetail: Decodable, Hashable {
    let albumName: String
    let slug: String
    let imageCount: Int
    let albumPhotos: [Photo]
    // used to build a shareable gallery link
    let secret: String?
    let `public`: Bool?
}

struct Photo: Codable, Hashable, Identifiable {
    let image: String
    let compressedImage: String
    let fileMetadata: PhotoMetadata
    var id: String { image }
    var isVideo: Bool { fileMetadata.contentType?.hasPrefix("video/") == true }
}

struct PhotoMetadata: Codable, Hashable {
    let filename: String
    let width: Int
    let height: Int
    let blurDataURL: String?
    let orientation: String?
    let size: Int?
    let contentType: String?
    let uploadDate: String?
    let exifData: String?  // raw EXIF as a JSON string

    enum CodingKeys: String, CodingKey {
        case filename
        case width
        case height
        case blurDataURL = "blurDataUrl"
        case orientation
        case size
        case contentType
        case uploadDate
        case exifData
    }
}

// GET /api/album/{slug}/faces — distinct people in the album
struct FaceSummary: Codable, Hashable, Identifiable {
    let faceId: String
    let name: String?
    let count: Int
    let imageUrl: String
    let filenames: [String]

    var id: String { faceId }
}

// GET /api/me/files — deliverables the photographer prepared for this client
// GET /api/me/home — everything waiting for a client, in one call
struct HomeSummary: Decodable {
    let firstName: String?
    let albums: [HomeAlbum]
    let files: [ClientFile]
    let totals: HomeTotals
}

struct HomeTotals: Decodable {
    let photos: Int
    let videos: Int
    let files: Int
}

struct HomeAlbum: Decodable, Hashable, Identifiable {
    let id: Int
    let name: String
    let slug: String
    let date: String?
    let photoCount: Int
    let videoCount: Int
    let cover: String?

    // the album screen takes a summary; counts are all it needs from us
    var summary: AlbumSummary {
        AlbumSummary(albumId: id, albumName: name, slug: slug, imageCount: photoCount + videoCount, albumPhotos: nil)
    }
}

struct ClientFile: Codable, Hashable, Identifiable {
    let id: Int
    let albumName: String?
    let filename: String
    let size: Int?
    let contentType: String?
    let createdAt: String?
    let downloadUrl: String?
}

extension PhotoMetadata {
    /// EXIF as a dictionary. Some uploads store it JSON-encoded twice, so a
    /// string that parses to another string gets one more pass.
    var exif: [String: Any]? {
        guard let raw = exifData, let data = raw.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)
        else { return nil }
        if let dict = parsed as? [String: Any] { return dict }
        if let inner = parsed as? String, let d = inner.data(using: .utf8) {
            return (try? JSONSerialization.jsonObject(with: d)) as? [String: Any]
        }
        return nil
    }

    /// When the shutter fired, from EXIF DateTimeOriginal.
    var takenAt: Date? {
        guard let s = (exif?["DateTimeOriginal"] as? String) ?? (exif?["DateTime"] as? String) else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy:MM:dd HH:mm:ss"
        return f.date(from: s)
    }
}
