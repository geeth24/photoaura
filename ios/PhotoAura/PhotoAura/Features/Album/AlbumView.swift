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
    // the home's "save all" lands here with the sheet up as soon as photos load
    var openActions: Bool = false
    @Environment(APIClient.self) private var api
    @State private var store: AlbumStore?
    @State private var activeViewerPhotoID: String? = nil
    @State private var openPhoto: PhotoTarget?
    @State private var actionsPresented = false
    @State private var tileFrames = TileFrames()

    var body: some View {
        Group {
            if let store {
                AlbumContent(store: store, frames: tileFrames, focusID: activeViewerPhotoID) { target in
                    activeViewerPhotoID = target.sourceID
                    // the viewer animates itself out of the tile; the cover must not slide up
                    withTransaction(.instant) { openPhoto = target }
                }
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
        .onChange(of: store?.state.photos.isEmpty ?? true) { _, empty in
            if openActions, !empty, !actionsPresented { actionsPresented = true }
        }
        .navigationTitle(album.albumName)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let photos = store?.state.photos, !photos.isEmpty {
                    Button {
                        actionsPresented = true
                    } label: {
                        Image(systemName: "square.and.arrow.down")
                    }
                    .accessibilityLabel("Get your photos")
                }
            }
        }
        .sheet(isPresented: $actionsPresented) {
            if let store {
                GalleryActionsSheet(
                    albumName: store.state.title,
                    slug: store.state.slug,
                    secret: store.state.detail?.secret,
                    photos: store.state.photos
                )
            }
        }
        .fullScreenCover(item: $openPhoto) { target in
            if let store {
                PhotoViewer(
                    photos: store.state.photos,
                    startIndex: target.index,
                    currentPhotoID: $activeViewerPhotoID,
                    albumSlug: store.state.slug,
                    sourceFrame: { tileFrames.rects[$0] },
                    onClose: {
                        withTransaction(.instant) { openPhoto = nil }
                    }
                )
                .presentationBackground(.clear)
            }
        }
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
    let frames: TileFrames
    // the photo the viewer is on; the grid keeps it on screen for the zoom back
    let focusID: String?
    let onOpen: (PhotoTarget) -> Void

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            ScrollViewReader { proxy in
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
                // scrolled while the viewer covers it, so closing zooms into a visible tile
                .onChange(of: focusID) { _, id in
                    if let id { proxy.scrollTo(id) }
                }
            }
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
            PhotoGridSkeleton()
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
            PhotoGrid(photos: store.state.photos, frames: frames, onOpen: onOpen)
        }
    }
}
