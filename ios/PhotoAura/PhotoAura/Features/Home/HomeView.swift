//
//  HomeView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 9/20/26.
//

import SwiftUI
import EditorialStyle

// pushed from the home's "save all" button — opens the album with its
// get-your-photos sheet already up
struct HomeSaveTarget: Hashable {
    let album: AlbumSummary
}

struct HomeView: View {
    @Environment(APIClient.self) private var api
    @State private var store: HomeStore?

    var body: some View {
        Group {
            if let store {
                HomeContent(store: store)
            } else {
                Color.clear
            }
        }
        .onAppear {
            guard store == nil else { return }
            let s = HomeStore(api: api)
            store = s
            s.send(.load)
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

private struct HomeContent: View {
    let store: HomeStore
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.xxLarge) {
                    content
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.xLarge)
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
            .refreshable { store.send(.refresh) }
        }
    }

    @ViewBuilder
    private var content: some View {
        if store.state.isLoading && !store.state.hasLoadedOnce {
            VStack(alignment: .leading, spacing: 16) {
                EditorialSkeleton(height: 14).frame(width: 120)
                EditorialSkeleton(height: 44).frame(width: 260)
                EditorialSkeleton(aspect: 4/3)
                EditorialSkeleton(height: 120)
            }
        } else if let err = store.state.error, store.state.summary == nil {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn't load",
                subtitle: err,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
        } else if let home = store.state.summary, let newest = home.albums.first {
            welcome(home)
            hero(newest)
            getPhotos(newest)
            if !home.files.isEmpty { files(home.files) }
            let rest = Array(home.albums.dropFirst())
            if !rest.isEmpty { earlier(rest) }
        } else {
            EditorialEmptyState(
                systemImage: "photo.on.rectangle",
                title: "Nothing here yet",
                subtitle: "Your photographer hasn't shared a gallery with you yet. You'll get an email when they do."
            )
        }
    }

    // MARK: - welcome + inventory

    private func welcome(_ home: HomeSummary) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            EditorialEyebrow("Your photos")

            VStack(alignment: .leading, spacing: 0) {
                Text(home.firstName.map { "Hi \($0)." } ?? "Welcome.")
                    .font(EditorialTypography.serif(size: 36))
                    .foregroundStyle(EditorialColors.textPrimary)
                Text(home.albums.count == 1 ? "Your gallery is ready." : "\(home.albums.count) galleries are ready.")
                    .font(EditorialTypography.serif(size: 36))
                    .foregroundStyle(EditorialColors.textSecondary)
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
            }

            HStack(spacing: EditorialSpacing.large) {
                stat(icon: "photo.on.rectangle", n: home.totals.photos, label: "photos")
                if home.totals.videos > 0 { stat(icon: "film", n: home.totals.videos, label: "videos") }
                if home.totals.files > 0 { stat(icon: "doc.zipper", n: home.totals.files, label: "to download") }
            }
            .padding(.top, EditorialSpacing.xSmall)
        }
    }

    private func stat(icon: String, n: Int, label: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(EditorialColors.brand)
            Text("\(n)")
                .font(EditorialTypography.serif(size: 22))
                .foregroundStyle(EditorialColors.textPrimary)
            Text(label.uppercased())
                .font(EditorialTypography.sans(size: 10, weight: .medium))
                .tracking(EditorialTypography.Tracking.eyebrow)
                .foregroundStyle(EditorialColors.textMuted)
        }
    }

    // MARK: - newest gallery

    private func hero(_ album: HomeAlbum) -> some View {
        NavigationLink(value: album.summary) {
            ZStack(alignment: .bottomLeading) {
                EditorialColors.surfaceCard
                    .aspectRatio(4/3, contentMode: .fit)
                    .overlay {
                        if let cover = album.cover, let url = URL(string: cover) {
                            CachedImage(url: url, contentMode: .fill)
                        }
                    }
                    .clipped()

                LinearGradient(
                    colors: [.black.opacity(0.85), .black.opacity(0.35), .clear],
                    startPoint: .bottom, endPoint: .top
                )
                .frame(height: 180)

                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(heroEyebrow(album))
                            .font(EditorialTypography.sans(size: 10, weight: .medium))
                            .tracking(EditorialTypography.Tracking.eyebrow)
                            .foregroundStyle(.white.opacity(0.65))
                        Text(album.name)
                            .font(EditorialTypography.serif(size: 30))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                        Text(countsText(album))
                            .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    Spacer(minLength: 12)
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .overlay(Rectangle().stroke(.white.opacity(0.4), lineWidth: 1))
                }
                .padding(EditorialSpacing.large)
            }
        }
        .buttonStyle(EditorialPressStyle())
    }

    private func heroEyebrow(_ album: HomeAlbum) -> String {
        let lead = (store.state.summary?.albums.count ?? 1) > 1 ? "NEWEST" : "GALLERY"
        if let d = prettyDate(album.date) { return "\(lead) · \(d.uppercased())" }
        return lead
    }

    // MARK: - get your photos

    private func getPhotos(_ album: HomeAlbum) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            EditorialEyebrow("Get your photos", color: EditorialColors.textMuted)

            NavigationLink(value: HomeSaveTarget(album: album.summary)) {
                HStack(spacing: 10) {
                    Image(systemName: "square.and.arrow.down.on.square")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Save all to Photos")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(EditorialTypography.Tracking.button)
                        .textCase(.uppercase)
                }
                .foregroundStyle(EditorialColors.background)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity)
                .background(EditorialColors.brand)
            }
            .buttonStyle(EditorialPressStyle())

            NavigationLink(value: album.summary) {
                HStack(spacing: 10) {
                    Image(systemName: "photo.on.rectangle")
                        .font(.system(size: 14, weight: .medium))
                    Text("Browse the gallery")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(EditorialTypography.Tracking.button)
                        .textCase(.uppercase)
                }
                .foregroundStyle(EditorialColors.textSecondary)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity)
                .overlay(Rectangle().stroke(EditorialColors.borderDefault, lineWidth: 1))
            }
            .buttonStyle(EditorialPressStyle())

            Text("Every one of the \(album.photoCount) originals goes straight into your camera roll, full quality. You can also share the gallery or grab a zip from inside it.")
                .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                .foregroundStyle(EditorialColors.textMuted)
                .lineSpacing(EditorialTypography.LineSpacing.hint)
        }
        .padding(EditorialSpacing.large)
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
    }

    // MARK: - files

    private func files(_ files: [ClientFile]) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            EditorialEyebrow("Ready to download", color: EditorialColors.textMuted)
            VStack(spacing: 10) {
                ForEach(files) { file in
                    Button {
                        if let s = file.downloadUrl, let url = URL(string: s) { openURL(url) }
                    } label: {
                        HStack(spacing: EditorialSpacing.medium) {
                            Image(systemName: fileIcon(file))
                                .font(.system(size: 16, weight: .regular))
                                .foregroundStyle(EditorialColors.brand)
                                .frame(width: 40, height: 40)
                                .background(EditorialColors.brand.opacity(0.1))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(file.filename)
                                    .font(EditorialTypography.sans(size: EditorialTypography.Size.body, weight: .medium))
                                    .foregroundStyle(EditorialColors.textPrimary)
                                    .lineLimit(1)
                                Text(fileSubtitle(file))
                                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                                    .foregroundStyle(EditorialColors.textMuted)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.down.circle.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(EditorialColors.brand)
                        }
                        .padding(EditorialSpacing.medium)
                        .background(EditorialColors.surfaceElevated)
                        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(file.downloadUrl == nil)
                }
            }
            Text("Zips open in the Files app. For your camera roll, use Save all to Photos above.")
                .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                .foregroundStyle(EditorialColors.textMuted)
        }
    }

    // MARK: - earlier galleries

    private func earlier(_ albums: [HomeAlbum]) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            EditorialEyebrow("Earlier galleries", color: EditorialColors.textMuted)
            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
                spacing: 12
            ) {
                ForEach(albums) { album in
                    NavigationLink(value: album.summary) {
                        EditorialPhotoCard(title: album.name, caption: countsText(album), aspect: 4 / 5) {
                            if let cover = album.cover, let url = URL(string: cover) {
                                CachedImage(url: url, contentMode: .fill)
                            } else {
                                EditorialColors.surfaceElevated
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - helpers

    private func countsText(_ album: HomeAlbum) -> String {
        var bits = ["\(album.photoCount) \(album.photoCount == 1 ? "photo" : "photos")"]
        if album.videoCount > 0 { bits.append("\(album.videoCount) \(album.videoCount == 1 ? "video" : "videos")") }
        return bits.joined(separator: " · ")
    }

    // album dates are free text; only tidy the ones that parse
    private func prettyDate(_ s: String?) -> String? {
        guard let s, !s.isEmpty else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        for pattern in ["yyyy-MM-dd HH:mm:ss.SSSSSS", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd"] {
            f.dateFormat = pattern
            if let d = f.date(from: s) { return d.formatted(.dateTime.month(.wide).day().year()) }
        }
        return s
    }

    private func fileIcon(_ file: ClientFile) -> String {
        let name = file.filename.lowercased()
        if name.hasSuffix(".zip") { return "doc.zipper" }
        if name.hasSuffix(".pdf") { return "doc.richtext" }
        if (file.contentType ?? "").hasPrefix("video/") { return "film" }
        if (file.contentType ?? "").hasPrefix("image/") { return "photo" }
        return "doc"
    }

    private func fileSubtitle(_ file: ClientFile) -> String {
        var bits: [String] = []
        if let album = file.albumName, !album.isEmpty { bits.append(album) }
        if let size = file.size, size > 0 {
            bits.append(ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file))
        }
        return bits.joined(separator: " · ")
    }
}
