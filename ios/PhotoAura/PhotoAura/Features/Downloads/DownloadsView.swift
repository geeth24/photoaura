//
//  DownloadsView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 8/25/26.
//
//  Deliverables the photographer prepared — usually a zip of the originals.
//  Until now these were only reachable on the web.
//

import SwiftUI
import EditorialStyle

struct DownloadsView: View {
    @Environment(APIClient.self) private var api
    @State private var store: DownloadsStore?

    var body: some View {
        Group {
            if let store {
                DownloadsContent(store: store)
            } else {
                Color.clear
            }
        }
        .onAppear {
            if store == nil {
                let s = DownloadsStore(api: api)
                store = s
                s.send(.load)
            }
        }
        .navigationTitle("Downloads")
        .navigationBarTitleDisplayMode(.large)
    }
}

private struct DownloadsContent: View {
    let store: DownloadsStore
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
                if store.state.isLoading && !store.state.hasLoadedOnce {
                    ForEach(0..<3, id: \.self) { _ in
                        EditorialSkeleton(aspect: 5)
                    }
                } else if let error = store.state.error {
                    EditorialEmptyState(
                        systemImage: "exclamationmark.triangle",
                        title: "Couldn't load",
                        subtitle: error,
                        actionTitle: "Try again"
                    ) {
                        store.send(.refresh)
                    }
                } else if store.state.files.isEmpty {
                    EditorialEmptyState(
                        systemImage: "arrow.down.circle",
                        title: "Nothing here yet",
                        subtitle: "When your photographer prepares files for you — like a zip of your originals — they'll show up here."
                    )
                } else {
                    ForEach(store.state.files) { file in
                        fileRow(file)
                    }
                }
            }
            .padding(.horizontal, EditorialSpacing.screenGutter)
            .padding(.top, EditorialSpacing.small)
            .padding(.bottom, EditorialSpacing.xxxLarge)
        }
        .refreshable { store.send(.refresh) }
    }

    private func fileRow(_ file: ClientFile) -> some View {
        Button {
            if let s = file.downloadUrl, let url = URL(string: s) { openURL(url) }
        } label: {
            HStack(spacing: EditorialSpacing.medium) {
                Image(systemName: icon(for: file))
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(EditorialColors.brand)
                    .frame(width: 34, height: 34)

                VStack(alignment: .leading, spacing: 3) {
                    Text(file.filename)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.body, weight: .medium))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text(subtitle(for: file))
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                        .foregroundStyle(EditorialColors.textMuted)
                }

                Spacer(minLength: 0)

                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(EditorialColors.brand)
            }
            .padding(EditorialSpacing.medium)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(EditorialColors.surfaceElevated)
            .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(file.downloadUrl == nil)
    }

    private func icon(for file: ClientFile) -> String {
        let name = file.filename.lowercased()
        if name.hasSuffix(".zip") { return "doc.zipper" }
        if name.hasSuffix(".pdf") { return "doc.richtext" }
        if (file.contentType ?? "").hasPrefix("video/") { return "film" }
        if (file.contentType ?? "").hasPrefix("image/") { return "photo" }
        return "doc"
    }

    private func subtitle(for file: ClientFile) -> String {
        var bits: [String] = []
        if let album = file.albumName, !album.isEmpty { bits.append(album) }
        if let size = file.size, size > 0 { bits.append(byteText(size)) }
        if let created = file.createdAt, let date = isoDate(created) {
            bits.append(date.formatted(.dateTime.month(.abbreviated).day().year()))
        }
        return bits.joined(separator: " · ")
    }

    private func byteText(_ bytes: Int) -> String {
        let units = ["B", "KB", "MB", "GB"]
        var value = Double(bytes)
        var i = 0
        while value >= 1024 && i < units.count - 1 {
            value /= 1024
            i += 1
        }
        return String(format: value >= 10 || i == 0 ? "%.0f %@" : "%.1f %@", value, units[i])
    }

    // the API sends a naive timestamp ("2026-06-06T23:43:46.930222") with no
    // zone, which ISO8601DateFormatter refuses outright — fall back to plain
    // formats so the date doesn't silently disappear
    private static let naiveFormats = [
        "yyyy-MM-dd'T'HH:mm:ss.SSSSSS",
        "yyyy-MM-dd'T'HH:mm:ss.SSS",
        "yyyy-MM-dd'T'HH:mm:ss",
    ]

    private func isoDate(_ s: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: s) { return d }
        if let d = ISO8601DateFormatter().date(from: s) { return d }
        for format in Self.naiveFormats {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.timeZone = TimeZone(identifier: "UTC")
            f.dateFormat = format
            if let d = f.date(from: s) { return d }
        }
        return nil
    }
}
