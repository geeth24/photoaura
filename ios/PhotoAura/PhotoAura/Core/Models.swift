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
}

struct Photo: Codable, Hashable, Identifiable {
    let image: String
    let compressedImage: String
    let fileMetadata: PhotoMetadata
    var id: String { image }
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
