//
//  StudioRegistry.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//
//  Holds the list of available studios + which one's currently selected.
//  Persists via UserDefaults so the choice survives launches.
//

import Foundation

@Observable
final class StudioRegistry {
    static let builtIn: [Studio] = [.reactiveShots]

    private(set) var custom: [Studio] = []
    private(set) var selectedID: String

    private let customKey = "studio.custom"
    private let selectedKey = "studio.selected"
    private let defaults = UserDefaults.standard

    init() {
        let saved = (try? JSONDecoder().decode([Studio].self,
                                               from: defaults.data(forKey: customKey) ?? Data())) ?? []
        self.custom = saved
        self.selectedID = defaults.string(forKey: selectedKey) ?? Studio.reactiveShots.id
    }

    var all: [Studio] {
        Self.builtIn + custom
    }

    var selected: Studio {
        all.first(where: { $0.id == selectedID }) ?? .reactiveShots
    }

    func select(_ studio: Studio) {
        selectedID = studio.id
        defaults.set(studio.id, forKey: selectedKey)
    }

    func addCustom(name: String, apiURL: URL) -> Studio {
        let id = "custom-" + UUID().uuidString.prefix(8).lowercased()
        let s = Studio(
            id: id,
            name: name,
            apiURL: apiURL,
            webURL: nil,
            isBuiltIn: false
        )
        custom.append(s)
        persistCustom()
        return s
    }

    func removeCustom(_ studio: Studio) {
        guard !studio.isBuiltIn else { return }
        custom.removeAll { $0.id == studio.id }
        persistCustom()
        if selectedID == studio.id {
            select(.reactiveShots)
        }
    }

    private func persistCustom() {
        guard let data = try? JSONEncoder().encode(custom) else { return }
        defaults.set(data, forKey: customKey)
    }
}
