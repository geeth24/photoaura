//
//  AllPhotosView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import EditorialStyle

struct AllPhotosView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthStore.self) private var auth
    @State private var store: AllPhotosStore?
    @State private var activeViewerPhotoID: String? = nil
    @State private var openPhoto: PhotoTarget?
    @State private var tileFrames = TileFrames()

    var body: some View {
        Group {
            if let store {
                AllPhotosContent(store: store, frames: tileFrames, focusID: activeViewerPhotoID) { target in
                    activeViewerPhotoID = target.sourceID
                    // the viewer animates itself out of the tile; the cover must not slide up
                    withTransaction(.instant) { openPhoto = target }
                }
            } else {
                Color.clear
            }
        }
        .onAppear {
            guard store == nil, case .signedIn(let user) = auth.status else { return }
            let s = AllPhotosStore(api: api, userId: user.id)
            store = s
            s.send(.load)
        }
        .navigationTitle("Your photos")
        .navigationBarTitleDisplayMode(.large)
        .fullScreenCover(item: $openPhoto) { target in
            if let store {
                PhotoViewer(
                    photos: store.state.photos,
                    startIndex: target.index,
                    currentPhotoID: $activeViewerPhotoID,
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

private struct AllPhotosContent: View {
    let store: AllPhotosStore
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
                            eyebrow: "Library",
                            subtitle: subtitleText
                        )
                        .padding(.horizontal, EditorialSpacing.screenGutter)
                        .padding(.top, EditorialSpacing.medium)

                        EditorialSegmentedControl(
                            items: OrientationFilter.allCases.map { ($0.label, $0) },
                            selection: Binding(
                                get: { store.state.orientation },
                                set: { store.send(.orientationChanged($0)) }
                            )
                        )
                        .padding(.horizontal, EditorialSpacing.screenGutter)

                        grid
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
        if store.state.isLoading && store.state.photos.isEmpty { return "Loading…" }
        let n = store.state.photos.count
        return "\(n) \(n == 1 ? "photo" : "photos")"
    }

    @ViewBuilder
    private var grid: some View {
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
                subtitle: "Try a different orientation, or wait for your photographer to share a gallery."
            )
            .padding(.horizontal, EditorialSpacing.screenGutter)
        } else {
            PhotoGrid(photos: store.state.photos, frames: frames, onOpen: onOpen)
        }
    }
}
