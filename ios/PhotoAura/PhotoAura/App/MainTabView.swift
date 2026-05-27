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

    enum AppTab: Hashable { case galleries, allPhotos, profile }

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

            Tab("Profile", systemImage: "person.crop.circle", value: AppTab.profile) {
                NavigationStack { ProfileView() }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .tint(EditorialColors.brand)
    }
}
