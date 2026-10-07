//
//  DocumentPreview.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import QuickLook

/// A downloaded PDF sitting in the temp folder, ready for Quick Look.
struct PreviewDocument: Identifiable, Hashable {
    let url: URL
    var id: URL { url }

    /// The PDFs come back as bytes behind the bearer token, so they're written
    /// out under their real name; Quick Look's share sheet uses it.
    static func write(_ data: Data, named name: String) throws -> PreviewDocument {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("documents", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        try data.write(to: url, options: .atomic)
        return PreviewDocument(url: url)
    }
}

/// Quick Look in a sheet: page through the PDF, share it, save it to Files.
struct DocumentPreviewSheet: UIViewControllerRepresentable {
    let document: PreviewDocument
    let onDone: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(url: document.url) }

    func makeUIViewController(context: Context) -> UINavigationController {
        let preview = QLPreviewController()
        preview.dataSource = context.coordinator
        preview.navigationItem.leftBarButtonItem = UIBarButtonItem(
            systemItem: .done,
            primaryAction: UIAction { _ in onDone() }
        )
        return UINavigationController(rootViewController: preview)
    }

    func updateUIViewController(_ controller: UINavigationController, context: Context) {}

    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL
        init(url: URL) { self.url = url }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            url as NSURL
        }
    }
}

extension View {
    /// Presents a downloaded document in Quick Look while `document` is set.
    func documentPreview(_ document: PreviewDocument?, onDismiss: @escaping () -> Void) -> some View {
        sheet(item: Binding(get: { document }, set: { if $0 == nil { onDismiss() } })) { doc in
            DocumentPreviewSheet(document: doc, onDone: onDismiss)
                .ignoresSafeArea()
        }
    }
}
