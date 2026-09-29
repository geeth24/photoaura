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
    // pairs the tapped tile with the viewer so it grows out of the thumbnail
    @Namespace private var photoTransition

    var body: some View {
        Group {
            if let store {
                AllPhotosContent(store: store, transition: photoTransition) { openPhoto = $0 }
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
        .navigationDestination(item: $openPhoto) { target in
            if let store {
                PhotoViewer(
                    photos: store.state.photos,
                    startIndex: target.index,
                    currentPhotoID: $activeViewerPhotoID
                )
                .navigationTransition(.zoom(sourceID: target.sourceID, in: photoTransition))
                .toolbar(.hidden, for: .navigationBar)
                .toolbar(.hidden, for: .tabBar)
            }
        }
    }
}

private struct AllPhotosContent: View {
    let store: AllPhotosStore
    let transition: Namespace.ID
    let onOpen: (PhotoTarget) -> Void

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
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
            PhotoGrid(photos: store.state.photos, transition: transition, onOpen: onOpen)
        }
    }
}
