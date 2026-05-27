//
//  RootView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import EditorialStyle

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(NetworkMonitor.self) private var network

    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false

    var body: some View {
        ZStack(alignment: .top) {
            EditorialColors.background.ignoresSafeArea()

            content
                .transition(.opacity)

            if !network.isOnline {
                offlineBanner
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: statusKey)
        .animation(.easeInOut(duration: 0.25), value: network.isOnline)
    }

    @ViewBuilder
    private var content: some View {
        if !hasSeenOnboarding {
            OnboardingView { hasSeenOnboarding = true }
        } else {
            switch auth.status {
            case .checking:
                SplashView()
            case .signedOut:
                LoginView()
            case .signedIn:
                MainTabView()
            }
        }
    }

    private var statusKey: String {
        if !hasSeenOnboarding { return "onboarding" }
        switch auth.status {
        case .checking: return "checking"
        case .signedOut: return "out"
        case .signedIn: return "in"
        }
    }

    private var offlineBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 12, weight: .semibold))
            Text("You're offline")
                .font(EditorialTypography.sans(size: 11, weight: .semibold))
                .tracking(1.6)
                .textCase(.uppercase)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.black.opacity(0.78))
        .clipShape(Capsule())
        .overlay(
            Capsule().stroke(.white.opacity(0.1), lineWidth: 1)
        )
        .padding(.top, 8)
        .frame(maxWidth: .infinity)
    }
}

private struct SplashView: View {
    var body: some View {
        VStack(spacing: EditorialSpacing.medium) {
            EditorialAssets.photoAuraLogo
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
            Text("PhotoAura").editorialBrandMark()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
