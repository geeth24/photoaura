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
    // pairs the tapped tile with the viewer so it expands from the thumbnail
    @Namespace private var photoTransition

    var body: some View {
        Group {
            if let store {
                AlbumContent(store: store, transition: photoTransition) { openPhoto = $0 }
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
        .navigationDestination(item: $openPhoto) { target in
            if let store {
                PhotoViewer(
                    photos: store.state.photos,
                    startIndex: target.index,
                    currentPhotoID: $activeViewerPhotoID,
                    albumSlug: store.state.slug
                )
                .navigationTransition(.zoom(sourceID: target.sourceID, in: photoTransition))
                .toolbar(.hidden, for: .navigationBar)
                .toolbar(.hidden, for: .tabBar)
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
    let transition: Namespace.ID
    let onOpen: (PhotoTarget) -> Void

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
            PhotoGrid(photos: store.state.photos, transition: transition, onOpen: onOpen)
        }
    }
}
