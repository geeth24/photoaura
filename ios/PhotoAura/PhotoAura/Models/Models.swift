//
//  Models.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

import Foundation

struct LoginResponse: Decodable {
    let message: String
    let accessToken: String
    let tokenType: String
    let user: UserDetail
    
    enum CodingKeys: String, CodingKey {
           case message
           case accessToken = "access_token"
           case tokenType = "token_type"
           case user
       }
}

struct UserDetail: Decodable, Encodable {
    let id: Int
    let userName: String
    let fullName: String
    let userEmail: String
    
    // Define keys to match the JSON field names
    enum CodingKeys: String, CodingKey {
        case id
        case userName = "user_name"
        case fullName = "full_name"
        case userEmail = "user_email"
    }
}


// Define the main album model
struct AlbumsModel: Decodable, Hashable{
    
    let albumId: Int?
    let albumName: String
    let slug: String
    let upload: Bool
    let imageCount: Int
    let albumPhotos: [AlbumModel]
    
    enum CodingKeys: String, CodingKey {
        case albumId = "album_id"
        case albumName = "album_name"
        case slug = "slug"
        case upload = "upload"
        case imageCount = "image_count"
        case albumPhotos = "album_photos"
    }
}

    
    

struct AlbumModel: Decodable, Hashable{
   
    
    
    let albumName: String
    let image: String
    let fileMetadata: FileMetadata
    
    enum CodingKeys: String, CodingKey {
        case albumName = "album_name"
        case image
        case fileMetadata = "file_metadata"
    }
}

// Define the file metadata model
struct FileMetadata: Decodable, Hashable {
    let fileName: String
    let contentType: String
    let size: Int
    let width: Int
    let height: Int
    let uploadDate: String
//    let exifData: String
    let blurDataURL: String
    
    enum CodingKeys: String, CodingKey {
        case fileName = "filename"
        case contentType = "content_type"
        case size
        case width
        case height
        case uploadDate = "upload_date"
//        case exifData = "exif_data"
        case blurDataURL = "blur_data_url"
    }
}
