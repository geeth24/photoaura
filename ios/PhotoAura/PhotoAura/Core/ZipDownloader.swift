//
//  ZipDownloader.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 8/25/26.
//
//  Downloads a gallery zip inside the app with visible progress. Handing the
//  URL to Safari worked but dumped the client into a browser with no idea how
//  long a 2GB download would take.
//

import Foundation

@Observable
@MainActor
final class ZipDownloader: NSObject {
    enum Phase: Equatable {
        case idle
        case downloading(received: Int64, expected: Int64)
        case finished(URL)
        case failed(String)
    }

    private(set) var phase: Phase = .idle
    private var task: URLSessionDownloadTask?
    private var suggestedName = "gallery.zip"

    /// nil until the server reports a length — a streamed zip has no size up front
    var fraction: Double? {
        guard case .downloading(let received, let expected) = phase, expected > 0 else { return nil }
        return min(1, Double(received) / Double(expected))
    }

    var receivedBytes: Int64 {
        if case .downloading(let received, _) = phase { return received }
        return 0
    }

    func start(url: URL, filename: String) {
        cancel()
        suggestedName = filename
        phase = .downloading(received: 0, expected: 0)
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        let t = session.downloadTask(with: url)
        task = t
        t.resume()
    }

    func cancel() {
        task?.cancel()
        task = nil
        phase = .idle
    }
}

extension ZipDownloader: URLSessionDownloadDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        Task { @MainActor in
            phase = .downloading(received: totalBytesWritten, expected: totalBytesExpectedToWrite)
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        // the temp file is deleted the moment this returns, so move it now —
        // and give it the real name so the share sheet offers the right file
        let name = MainActor.assumeIsolated { suggestedName }
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dest, withIntermediateDirectories: true)
            let target = dest.appendingPathComponent(name)
            try FileManager.default.moveItem(at: location, to: target)
            Task { @MainActor in phase = .finished(target) }
        } catch {
            Task { @MainActor in phase = .failed(error.localizedDescription) }
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        guard let error else { return }
        let cancelled = (error as NSError).code == NSURLErrorCancelled
        Task { @MainActor in
            if !cancelled, case .downloading = phase {
                phase = .failed(error.localizedDescription)
            }
        }
    }
}
