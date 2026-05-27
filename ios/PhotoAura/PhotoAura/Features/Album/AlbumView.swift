//
//  AlbumView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import EditorialStyle

struct AlbumView: View {
    let album: AlbumSummary
    @Environment(APIClient.self) private var api
    @State private var store: AlbumStore?
    @State private var presentedPhoto: PhotoTarget? = nil
    @State private var activeViewerPhotoID: String? = nil

    var body: some View {
        Group {
            if let store {
                AlbumContent(store: store, presentedPhoto: $presentedPhoto)
            } else {
                Color.clear
            }
        }
        .onAppear {
            if store == nil {
                let s = AlbumStore(api: api, slug: album.slug, initialName: album.albumName)
                store = s
                s.send(.load)
            }
        }
        .navigationTitle(album.albumName)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let shareURL = galleryShareURL {
                    ShareLink(item: shareURL) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
        // present-as-cover keeps the album's nav bar + tab bar in place
        // underneath the viewer. iOS 26 has a confirmed bug where
        // .navigationTransition(.zoom) re-renders the parent on interactive
        // dismiss — cover avoids it entirely.
        .fullScreenCover(item: $presentedPhoto) { target in
            if let store {
                PhotoViewer(
                    photos: store.state.photos,
                    startIndex: target.index,
                    currentPhotoID: $activeViewerPhotoID
                )
            }
        }
    }

    private var galleryShareURL: URL? {
        URL(string: "https://aura.reactiveshots.com/g/\(album.slug)")
    }
}

// presented to the photo viewer cover — index + the cell's photo id
struct PhotoTarget: Hashable, Identifiable {
    let index: Int
    let sourceID: String
    var id: String { sourceID }
}

private struct AlbumContent: View {
    let store: AlbumStore
    @Binding var presentedPhoto: PhotoTarget?

    private let columns = [
        GridItem(.flexible(), spacing: 4),
        GridItem(.flexible(), spacing: 4),
        GridItem(.flexible(), spacing: 4),
    ]

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                    EditorialSectionHeader(
                        eyebrow: "Gallery",
                        subtitle: subtitleText
                    )
                    .padding(.horizontal, EditorialSpacing.screenGutter)
                    .padding(.top, EditorialSpacing.medium)

                    if !store.state.faces.isEmpty {
                        facesStrip
                    }

                    content
                }
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
            .refreshable { store.send(.refresh) }
        }
    }

    private var subtitleText: String {
        if store.state.isLoading && store.state.detail == nil { return "Loading…" }
        let n = store.state.photos.count
        if let face = activeFace {
            return "Just \(face.name ?? "this face") — \(n) \(n == 1 ? "photo" : "photos")"
        }
        let total = store.state.detail?.imageCount ?? n
        return "\(total) \(total == 1 ? "photo" : "photos")"
    }

    private var activeFace: FaceSummary? {
        guard let id = store.state.selectedFaceId else { return nil }
        return store.state.faces.first { $0.faceId == id }
    }

    private var facesStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                ForEach(store.state.faces) { face in
                    EditorialFaceChip(
                        name: face.name,
                        count: face.count,
                        isActive: store.state.selectedFaceId == face.faceId,
                        action: { store.send(.selectFace(face.faceId)) }
                    ) {
                        AsyncImage(url: URL(string: face.imageUrl)) { img in
                            img.resizable().scaledToFill()
                        } placeholder: {
                            EditorialColors.surfaceElevated
                        }
                    }
                }
            }
            .padding(.horizontal, EditorialSpacing.screenGutter)
        }
    }

    @ViewBuilder
    private var content: some View {
        if store.state.isLoading && !store.state.hasLoadedOnce {
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(0..<9, id: \.self) { _ in
                    EditorialSkeleton(aspect: 1)
                }
            }
            .padding(.horizontal, 4)
        } else if let err = store.state.error, store.state.photos.isEmpty {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn't load",
                subtitle: err,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
            .padding(.horizontal, EditorialSpacing.screenGutter)
        } else if store.state.photos.isEmpty {
            EditorialEmptyState(
                systemImage: "photo.on.rectangle",
                title: "No photos",
                subtitle: store.state.selectedFaceId == nil
                    ? "This gallery is empty."
                    : "No photos of this person in the gallery."
            )
            .padding(.horizontal, EditorialSpacing.screenGutter)
        } else {
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(Array(store.state.photos.enumerated()), id: \.element.id) { idx, photo in
                    Button {
                        presentedPhoto = PhotoTarget(index: idx, sourceID: photo.id)
                    } label: {
                        Color.clear
                            .aspectRatio(1, contentMode: .fit)
                            .overlay {
                                AsyncImage(url: URL(string: photo.compressedImage)) { img in
                                    img.resizable().scaledToFill()
                                } placeholder: {
                                    EditorialColors.surfaceElevated
                                }
                            }
                            .clipped()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
    }
}
