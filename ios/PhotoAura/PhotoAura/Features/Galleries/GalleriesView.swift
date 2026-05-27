//
//  GalleriesView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import EditorialStyle

struct GalleriesView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthStore.self) private var auth
    @State private var store: GalleriesStore?

    var body: some View {
        Group {
            if let store {
                GalleriesContent(store: store)
            } else {
                Color.clear
            }
        }
        .onAppear {
            guard store == nil, case .signedIn(let user) = auth.status else { return }
            let s = GalleriesStore(api: api, userId: user.id)
            store = s
            s.send(.load)
        }
        .navigationTitle("Your galleries")
        .navigationBarTitleDisplayMode(.large)
    }
}

private struct GalleriesContent: View {
    let store: GalleriesStore

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.xLarge) {
                    EditorialSectionHeader(
                        eyebrow: "Library",
                        subtitle: subtitle
                    )

                    content
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.medium)
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
            .refreshable {
                store.send(.refresh)
            }
        }
    }

    private var subtitle: String {
        if store.state.isLoading && store.state.albums.isEmpty { return "Loading…" }
        let n = store.state.albums.count
        return n == 0 ? "Nothing here yet." : "\(n) \(n == 1 ? "gallery" : "galleries")"
    }

    @ViewBuilder
    private var content: some View {
        if store.state.isLoading && !store.state.hasLoadedOnce {
            VStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { _ in
                    EditorialSkeleton(aspect: 4/3)
                }
            }
        } else if let err = store.state.error, store.state.albums.isEmpty {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn't load",
                subtitle: err,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
        } else if store.state.albums.isEmpty {
            EditorialEmptyState(
                systemImage: "photo.on.rectangle",
                title: "No galleries yet",
                subtitle: "When your photographer shares one with you, it'll show up here."
            )
        } else {
            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12),
                ],
                spacing: 12
            ) {
                ForEach(store.state.albums) { album in
                    NavigationLink(value: album) {
                        EditorialPhotoCard(
                            title: album.albumName,
                            caption: "\(album.imageCount) photos",
                            aspect: 4 / 5
                        ) {
                            if let cover = album.coverImage, let url = URL(string: cover) {
                                AsyncImage(url: url) { img in
                                    img.resizable().scaledToFill()
                                } placeholder: {
                                    EditorialColors.surfaceElevated
                                }
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
}
