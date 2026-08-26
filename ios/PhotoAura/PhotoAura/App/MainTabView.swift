//
//  MainTabView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import EditorialStyle

struct MainTabView: View {
    @State private var selectedTab: AppTab = .galleries

    enum AppTab: Hashable { case galleries, allPhotos, downloads, profile }

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Galleries", systemImage: "photo.stack", value: AppTab.galleries) {
                NavigationStack {
                    GalleriesView()
                        .navigationDestination(for: AlbumSummary.self) { album in
                            AlbumView(album: album)
                        }
                }
            }

            Tab("All Photos", systemImage: "photo.on.rectangle.angled", value: AppTab.allPhotos) {
                NavigationStack { AllPhotosView() }
            }

            Tab("Downloads", systemImage: "arrow.down.circle", value: AppTab.downloads) {
                NavigationStack { DownloadsView() }
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
