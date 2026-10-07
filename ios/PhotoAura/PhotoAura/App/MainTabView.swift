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
    @Environment(APIClient.self) private var api
    @State private var selectedTab: AppTab = .galleries
    // the client's bookings decide whether their Bookings tab shows at all
    @State private var clientBookings: BookingsStore?

    enum AppTab: Hashable { case galleries, bookings, allPhotos, downloads, profile }

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
                    .appDestinations()
                }
            }

            if !isClient {
                Tab("Bookings", systemImage: "calendar", value: AppTab.bookings) {
                    NavigationStack { AdminBookingsView().appDestinations() }
                }
            }

            Tab("All Photos", systemImage: "photo.on.rectangle.angled", value: AppTab.allPhotos) {
                NavigationStack { AllPhotosView() }
            }

            // like the web, bookings only show up once the studio has sent one
            if isClient, let store = clientBookings, !store.state.bookings.isEmpty {
                Tab("Bookings", systemImage: "calendar", value: AppTab.bookings) {
                    NavigationStack { ClientBookingsView(store: store).appDestinations() }
                }
                .badge(store.state.actionCount)
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
        // a booking screen in any tab refreshes this when it closes
        .environment(clientBookings)
        .task(id: isClient) {
            guard isClient, clientBookings == nil else { return }
            let s = BookingsStore(api: api)
            clientBookings = s
            s.send(.load)
        }
        // signing or paying elsewhere changes the badge
        .onChange(of: selectedTab) { _, _ in clientBookings?.send(.refresh) }
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
