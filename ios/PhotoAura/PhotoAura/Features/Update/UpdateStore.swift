//
//  UpdateStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import UIKit

/// Asks the studio's server which app versions it still supports. Below the
/// minimum the app stops at an update screen; below the latest it asks once.
@Observable
@MainActor
final class UpdateStore {
    private(set) var state = UpdateState()
    let currentVersion: AppVersion?
    private let api: APIClient
    private let defaults = UserDefaults.standard
    private let dismissedKey = "update.dismissedLatest"

    static let throttle: TimeInterval = 60 * 60
    static let fallbackStoreURL = URL(string: "https://apps.apple.com/app/id6477320360")!

    init(api: APIClient, currentVersion: AppVersion? = .current) {
        self.api = api
        self.currentVersion = currentVersion
    }

    func send(_ intent: UpdateIntent) {
        switch intent {
        case .appBecameActive:
            guard !state.checking else { return }
            if let last = state.lastChecked, Date.now.timeIntervalSince(last) < Self.throttle { return }
            state.checking = true
            Task { [api] in
                do {
                    let config = try await api.appConfig()
                    self.send(.checked(config.ios))
                } catch {
                    self.send(.checkFailed)
                }
            }

        case .checked(let policy):
            state.checking = false
            state.lastChecked = .now
            state.prompt = prompt(for: policy)

        // a failed check never blocks anyone; try again next time we're opened
        case .checkFailed:
            state.checking = false

        case .dismissSuggestion:
            guard case .suggested(let policy) = state.prompt else { return }
            if let latest = policy.latestVersion { defaults.set(latest, forKey: dismissedKey) }
            state.prompt = nil

        case .openStore:
            UIApplication.shared.open(storeURL)
        }
    }

    var storeURL: URL {
        let policy: UpdatePolicy? = switch state.prompt {
        case .required(let p), .suggested(let p): p
        case nil: nil
        }
        guard let s = policy?.storeUrl, let url = URL(string: s), url.scheme?.hasPrefix("http") == true else {
            return Self.fallbackStoreURL
        }
        return url
    }

    private func prompt(for policy: UpdatePolicy?) -> UpdateState.Prompt? {
        guard let policy, let current = currentVersion else { return nil }
        if let min = AppVersion(policy.minVersion), current < min {
            return .required(policy)
        }
        if let latest = AppVersion(policy.latestVersion), current < latest,
           defaults.string(forKey: dismissedKey) != policy.latestVersion {
            return .suggested(policy)
        }
        return nil
    }
}
