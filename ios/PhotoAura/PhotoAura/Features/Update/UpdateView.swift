//
//  UpdateView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import SwiftUI
import EditorialStyle

extension View {
    /// Shows update prompts above everything the app has on screen.
    func updatePrompts(_ store: UpdateStore) -> some View {
        modifier(UpdatePromptsModifier(store: store))
    }
}

private struct UpdatePromptsModifier: ViewModifier {
    let store: UpdateStore
    @State private var window = UpdateWindow()

    func body(content: Content) -> some View {
        content
            .onChange(of: store.state.prompt, initial: true) { old, new in
                if new != nil {
                    window.show(store)
                } else if case .required = old {
                    window.hide()
                }
                // a dismissed suggestion hides the window once its sheet has slid away
            }
    }
}

/// Its own window, so the prompt sits over the photo viewer and any open
/// sheet, not just whatever the root view happens to be showing.
@MainActor
private final class UpdateWindow {
    private var window: UIWindow?

    func show(_ store: UpdateStore) {
        guard window == nil else { return }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else { return }

        let host = UIHostingController(rootView: UpdatePromptView(store: store) { [weak self] in self?.hide() })
        host.view.backgroundColor = .clear
        let w = UIWindow(windowScene: scene)
        w.windowLevel = .alert
        w.backgroundColor = .clear
        w.rootViewController = host
        w.makeKeyAndVisible()
        window = w
    }

    func hide() {
        guard let w = window else { return }
        w.isHidden = true
        window = nil
        w.windowScene?.windows.first { $0 !== w && !$0.isHidden }?.makeKey()
    }
}

private struct UpdatePromptView: View {
    let store: UpdateStore
    let onFinished: () -> Void

    var body: some View {
        Group {
            if case .required(let policy) = store.state.prompt {
                EditorialUpdateRequired(
                    message: policy.message,
                    currentVersion: store.currentVersion?.description,
                    requiredVersion: policy.minVersion
                ) {
                    store.send(.openStore)
                }
                .transition(.opacity)
            } else {
                Color.clear
            }
        }
        .sheet(isPresented: suggestionShown, onDismiss: {
            if store.state.prompt == nil { onFinished() }
        }) {
            if case .suggested(let policy) = store.state.prompt {
                EditorialConfirmSheet(
                    title: "A new version is available",
                    message: policy.message ?? suggestionMessage(policy),
                    systemImage: "arrow.down.app",
                    primaryLabel: "Update",
                    cancelLabel: "Not now"
                ) {
                    store.send(.openStore)
                }
            }
        }
        .tint(EditorialColors.brand)
    }

    private var suggestionShown: Binding<Bool> {
        Binding(
            get: { if case .suggested = store.state.prompt { true } else { false } },
            set: { shown in if !shown { store.send(.dismissSuggestion) } }
        )
    }

    private func suggestionMessage(_ policy: UpdatePolicy) -> String {
        guard let latest = policy.latestVersion else {
            return "Update PhotoAura from the App Store for the latest fixes and features."
        }
        return "PhotoAura \(latest) is on the App Store with the latest fixes and features."
    }
}
