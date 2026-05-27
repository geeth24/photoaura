//
//  OnboardingView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import EditorialStyle

struct OnboardingView: View {
    let onFinish: () -> Void

    @State private var index = 0

    private let pages: [Page] = [
        Page(
            eyebrow: "PhotoAura",
            title: "Your gallery,\nat your fingertips.",
            body: "When your photographer shares a gallery with you, it lands here. Browse the full shoot, filter to photos of you, and download originals.",
            systemImage: "photo.stack"
        ),
        Page(
            eyebrow: "How it works",
            title: "Sign in with the email\nyour photographer used.",
            body: "We'll send you a one-tap link — no password to remember. Open it on this device and you're in.",
            systemImage: "envelope.badge"
        ),
    ]

    private var isLastPage: Bool { index == pages.count - 1 }
    private var primaryLabel: String { isLastPage ? "Get started" : "Next" }
    // shared spring — page swipe, indicator pills, button label change, skip
    // fade all coast on this one curve so the whole screen moves together
    private let spring: Animation = .spring(response: 0.45, dampingFraction: 0.82)

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                EditorialBrandHeader(logoSize: 56)
                    .padding(.top, EditorialSpacing.xxLarge)

                TabView(selection: $index) {
                    ForEach(pages.indices, id: \.self) { i in
                        page(pages[i]).tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(spring, value: index)

                pageIndicator
                    .padding(.bottom, EditorialSpacing.large)

                VStack(spacing: EditorialSpacing.small) {
                    EditorialButton(primaryLabel) {
                        if !isLastPage {
                            withAnimation(spring) { index += 1 }
                        } else {
                            onFinish()
                        }
                    }
                    // crossfade the label text when it changes from "Next" → "Get started"
                    .contentTransition(.opacity)
                    .animation(spring, value: primaryLabel)

                    EditorialButton("Skip", style: .ghost) {
                        onFinish()
                    }
                    .opacity(isLastPage ? 0 : 1)
                    .allowsHitTesting(!isLastPage)
                    .animation(spring, value: isLastPage)
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.bottom, EditorialSpacing.xLarge)
            }
        }
    }

    private func page(_ p: Page) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.large) {
            Spacer(minLength: EditorialSpacing.xLarge)
            Image(systemName: p.systemImage)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(EditorialColors.brand)
            EditorialSectionHeader(
                title: p.title,
                eyebrow: p.eyebrow,
                subtitle: p.body
            )
            Spacer()
        }
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var pageIndicator: some View {
        HStack(spacing: 6) {
            ForEach(pages.indices, id: \.self) { i in
                Capsule()
                    .fill(i == index ? EditorialColors.brand : EditorialColors.borderStrong)
                    .frame(width: i == index ? 24 : 6, height: 4)
            }
        }
        .animation(spring, value: index)
    }

    private struct Page {
        let eyebrow: String
        let title: String
        let body: String
        let systemImage: String
    }
}

#Preview {
    OnboardingView(onFinish: {})
}
