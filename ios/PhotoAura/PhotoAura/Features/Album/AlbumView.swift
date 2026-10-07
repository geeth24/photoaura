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
    @Environment(AuthStore.self) private var auth
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
                var isClient = true
                if case .signedIn(let user) = auth.status { isClient = user.role != "admin" }
                let s = AlbumStore(api: api, slug: album.slug, initialName: album.albumName, initialLocked: album.isLocked, isClient: isClient)
                store = s
                s.send(.load)
            }
        }
        .onChange(of: store?.state.photos.isEmpty ?? true) { _, empty in
            if openActions, !empty, !actionsPresented, store?.state.isLocked == false { actionsPresented = true }
        }
        .navigationTitle(album.albumName)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                // a locked gallery has nothing to save yet; the banner says why
                if let store, !store.state.isLocked, !store.state.photos.isEmpty {
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
            if let store, !store.state.isLocked {
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
                    downloadsLocked: store.state.isLocked,
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

                        if store.state.isLocked {
                            ProofBanner(
                                studio: !store.state.isClient,
                                bookingNumber: store.state.lockBookingNumber,
                                amountCents: store.state.unlockAmountCents
                            )
                            .padding(.horizontal, EditorialSpacing.screenGutter)
                        }

                        if let revision = store.state.revision {
                            RevisionBanner(
                                revision: revision,
                                count: store.state.revisedCount,
                                onlyRevised: store.state.onlyRevised
                            ) {
                                store.send(.toggleOnlyRevised)
                            }
                            .padding(.horizontal, EditorialSpacing.screenGutter)
                        }

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
        let photos = n == 1 ? "photo" : "photos"
        if let face = activeFace {
            let updated = store.state.onlyRevised ? " updated" : ""
            return "Just \(face.name ?? "this face") — \(n)\(updated) \(photos)"
        }
        if store.state.onlyRevised, let revision = store.state.revision {
            return "\(revision.title) — \(n) updated \(photos)"
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

    private var emptySubtitle: String {
        switch (store.state.selectedFaceId != nil, store.state.onlyRevised) {
        case (true, true): return "None of the updated photos have this person in them."
        case (true, false): return "No photos of this person in the gallery."
        case (false, true): return "No updated photos to show yet."
        case (false, false): return "This gallery is empty."
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
                subtitle: emptySubtitle
            )
            .padding(.horizontal, EditorialSpacing.screenGutter)
        } else {
            PhotoGrid(photos: store.state.photos, frames: frames, onOpen: onOpen)
        }
    }
}
