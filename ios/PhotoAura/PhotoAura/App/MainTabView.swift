//
//  MainTabView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import EditorialStyle

struct MainTabView: View {
    @Environment(AuthStore.self) private var auth
    @State private var selectedTab: AppTab = .galleries

    enum AppTab: Hashable { case galleries, allPhotos, downloads, profile }

    private var isClient: Bool {
        if case .signedIn(let user) = auth.status { return user.role == "client" }
        return true
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            // a client gets a home that says what's waiting; the studio keeps its library
            Tab(isClient ? "Home" : "Galleries", systemImage: isClient ? "house" : "photo.stack", value: AppTab.galleries) {
                NavigationStack {
                    Group {
                        if isClient { HomeView() } else { GalleriesView() }
                    }
                    .navigationDestination(for: AlbumSummary.self) { album in
                        AlbumView(album: album)
                    }
                    .navigationDestination(for: HomeSaveTarget.self) { target in
                        AlbumView(album: target.album, openActions: true)
                    }
                }
            }

            Tab("All Photos", systemImage: "photo.on.rectangle.angled", value: AppTab.allPhotos) {
                NavigationStack { AllPhotosView() }
            }

            // their files live on the home now
            if !isClient {
                Tab("Downloads", systemImage: "arrow.down.circle", value: AppTab.downloads) {
                    NavigationStack { DownloadsView() }
                }
            }

            Tab("Profile", systemImage: "person.crop.circle", value: AppTab.profile) {
                NavigationStack { ProfileView() }
            }
        }
        .modifier(MinimizeTabBarIfAvailable())
        .tint(EditorialColors.brand)
    }
}

// iOS 26 minimize-on-scroll tab bar; no-op on iOS 18–25
private struct MinimizeTabBarIfAvailable: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
    }
}
