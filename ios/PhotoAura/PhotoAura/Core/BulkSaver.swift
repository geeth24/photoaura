//
//  BulkSaver.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 6/23/26.
//
//  Saving a whole gallery to Photos. A zip is useless on iOS — clients want the
//  pictures in their camera roll — so we save each original as an asset instead.
//

import Foundation
import Photos

enum BulkSaveError: LocalizedError {
    case denied
    var errorDescription: String? {
        "Photos access denied. Enable it in Settings."
    }
}

enum BulkSaver {
    /// Ask once for the whole run rather than per photo.
    static func requestAccess() async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw BulkSaveError.denied }
    }

    /// Save one item. Video goes via a temp file so a large clip never sits in memory.
    static func save(url: URL, isVideo: Bool) async throws {
        if isVideo {
            let (tmp, resp) = try await URLSession.shared.download(from: url)
            defer { try? FileManager.default.removeItem(at: tmp) }
            try check(resp)
            // the downloaded temp file has no extension; Photos needs one
            let dest = tmp.deletingLastPathComponent()
                .appendingPathComponent(UUID().uuidString + ".mp4")
            try FileManager.default.moveItem(at: tmp, to: dest)
            defer { try? FileManager.default.removeItem(at: dest) }
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.forAsset()
                    .addResource(with: .video, fileURL: dest, options: nil)
            }
        } else {
            let (data, resp) = try await URLSession.shared.data(from: url)
            try check(resp)
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.forAsset()
                    .addResource(with: .photo, data: data, options: nil)
            }
        }
    }

    private static func check(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw URLError(.badServerResponse)
        }
    }
}
