//
//  Studio.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//
//  A "studio" is one tenant of the PhotoAura platform — a photography
//  business with their own backend URL and brand.
//

import Foundation

struct Studio: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let apiURL: URL
    let webURL: URL?
    /// `true` for studios baked into the app (Reactive Shots and partners
    /// we ship support for). Custom user-added studios are `false`.
    let isBuiltIn: Bool

    static let reactiveShots = Studio(
        id: "reactive-shots",
        name: "Reactive Shots",
        apiURL: URL(string: "https://aura-api.reactiveshots.com/api")!,
        webURL: URL(string: "https://aura.reactiveshots.com"),
        isBuiltIn: true
    )
}
