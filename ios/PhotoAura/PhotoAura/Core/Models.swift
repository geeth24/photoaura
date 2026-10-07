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
    // proof mode: watermarked previews until the booking's final payment
    var locked: Bool? = nil

    var id: Int { albumId }
    var coverImage: String? { albumPhotos?.first?.compressedImage }
    var isLocked: Bool { locked == true }
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
    // latest re-edit pushed after delivery; nil until there is one
    let revision: AlbumRevision?
    // proof mode: the server refuses originals and zips until it's paid
    let locked: Bool?
    let bookingNumber: String?

    var isLocked: Bool { locked == true }
}

// one numbered re-edit of a delivered album; the delivery itself is version 1
struct AlbumRevision: Decodable, Hashable {
    let number: Int
    let note: String?
    let photoCount: Int?
    let createdAt: String?
    let notifiedAt: String?

    enum CodingKeys: String, CodingKey { case number, note, photoCount, createdAt, notifiedAt }

    // a half-formed revision shouldn't take the whole album down with it
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        number = (try? c.decode(Int.self, forKey: .number)) ?? 0
        note = (try? c.decodeIfPresent(String.self, forKey: .note)).flatMap { $0.isEmpty ? nil : $0 }
        photoCount = try? c.decodeIfPresent(Int.self, forKey: .photoCount)
        createdAt = try? c.decodeIfPresent(String.self, forKey: .createdAt)
        notifiedAt = try? c.decodeIfPresent(String.self, forKey: .notifiedAt)
    }

    var title: String { "Revision \(number)" }
}

// GET /api/photo/{id}/versions — every edit of one photo, oldest first
struct PhotoVersion: Decodable, Hashable, Identifiable {
    let version: Int
    let filename: String?
    let revisionNumber: Int?
    let uploadedAt: String?
    let width: Int?
    let height: Int?
    let image: String?
    let compressedImage: String?

    var id: Int { version }

    enum CodingKeys: String, CodingKey {
        case version, filename, revisionNumber, uploadedAt, width, height, image, compressedImage
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = (try? c.decode(Int.self, forKey: .version)) ?? 1
        filename = try? c.decodeIfPresent(String.self, forKey: .filename)
        revisionNumber = try? c.decodeIfPresent(Int.self, forKey: .revisionNumber)
        uploadedAt = try? c.decodeIfPresent(String.self, forKey: .uploadedAt)
        width = try? c.decodeIfPresent(Int.self, forKey: .width)
        height = try? c.decodeIfPresent(Int.self, forKey: .height)
        image = try? c.decodeIfPresent(String.self, forKey: .image)
        compressedImage = try? c.decodeIfPresent(String.self, forKey: .compressedImage)
    }
}

struct Photo: Codable, Hashable, Identifiable {
    let image: String
    let compressedImage: String
    let fileMetadata: PhotoMetadata
    // set on every photo of a proof-locked album
    var locked: Bool? = nil
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
    let id: Int?
    let version: Int?
    // the revision that last replaced this photo
    let revisionNumber: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case version
        case revisionNumber
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
    let revision: AlbumRevision?
    let locked: Bool?
    let bookingNumber: String?

    var isLocked: Bool { locked == true }

    // the album screen takes a summary; counts are all it needs from us
    var summary: AlbumSummary {
        AlbumSummary(albumId: id, albumName: name, slug: slug, imageCount: photoCount + videoCount, albumPhotos: nil, locked: locked)
    }
}

// GET /api/app-config — the store update policy, per platform
struct AppConfig: Decodable {
    let ios: UpdatePolicy?
}

struct UpdatePolicy: Decodable, Equatable {
    let minVersion: String?
    let latestVersion: String?
    let storeUrl: String?
    let message: String?
    let updatedAt: String?
}

struct ClientFile: Codable, Hashable, Identifiable {
    let id: Int
    let albumName: String?
    let filename: String
    let size: Int?
    let contentType: String?
    let createdAt: String?
    let downloadUrl: String?
    // no download link until the album's final payment
    var locked: Bool? = nil
}

extension PhotoMetadata {
    var currentVersion: Int { max(version ?? 1, 1) }
    var isRevised: Bool { currentVersion > 1 }

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
