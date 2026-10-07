//
//  AppDestinations.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

extension View {
    /// Galleries and bookings link to each other, so every tab that shows
    /// either can push both. Apply once, at the root of a NavigationStack.
    func appDestinations() -> some View {
        navigationDestination(for: AlbumSummary.self) { album in
            AlbumView(album: album)
        }
        .navigationDestination(for: HomeSaveTarget.self) { target in
            AlbumView(album: target.album, openActions: true)
        }
        .navigationDestination(for: BookingRoute.self) { route in
            BookingScreen(number: route.number)
        }
    }
}
