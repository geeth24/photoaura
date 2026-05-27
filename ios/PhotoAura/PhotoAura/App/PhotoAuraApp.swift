//
//  PhotoAuraApp.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import EditorialStyle

@main
struct PhotoAuraApp: App {
    @State private var api: APIClient
    @State private var auth: AuthStore
    @State private var studios = StudioRegistry()
    @State private var network = NetworkMonitor()

    init() {
        EditorialNavigationStyle.apply()
        Self.configureImageCache()
        let registry = StudioRegistry()
        let client = APIClient(baseURL: registry.selected.apiURL)
        _api = State(initialValue: client)
        _auth = State(initialValue: AuthStore(api: client))
        _studios = State(initialValue: registry)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(api)
                .environment(auth)
                .environment(studios)
                .environment(network)
                .tint(EditorialColors.brand)
                .task { await auth.bootstrap() }
                .onOpenURL { url in
                    DeepLink.handle(url, auth: auth, api: api)
                }
                // when the picker changes studios, point the API client at the
                // new tenant and sign out so the old tenant's token is dropped
                .onChange(of: studios.selectedID) { _, _ in
                    api.baseURL = studios.selected.apiURL
                    auth.signOut()
                }
        }
    }

    private static func configureImageCache() {
        let memoryMB = 100
        let diskMB = 1024
        URLCache.shared = URLCache(
            memoryCapacity: memoryMB * 1024 * 1024,
            diskCapacity: diskMB * 1024 * 1024,
            directory: nil
        )
    }
}
