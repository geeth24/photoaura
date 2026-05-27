//
//  EditorialPhotoCard.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialPhotoCard<ImageContent: View>: View {
    private let title: String
    private let caption: String?
    private let aspect: CGFloat
    private let image: ImageContent
    private let action: (() -> Void)?

    public init(
        title: String,
        caption: String? = nil,
        aspect: CGFloat = 4 / 3,
        action: (() -> Void)? = nil,
        @ViewBuilder image: () -> ImageContent
    ) {
        self.title = title
        self.caption = caption
        self.aspect = aspect
        self.action = action
        self.image = image()
    }

    public var body: some View {
        let card = ZStack(alignment: .bottomLeading) {
            // Color.clear holds the aspect ratio; image overlays + scales to fill.
            // This is the canonical SwiftUI pattern for "fixed aspect, cropped image"
            // — applying .aspectRatio directly to an image lets it overflow.
            Color.clear
                .aspectRatio(aspect, contentMode: .fit)
                .overlay {
                    image
                }
                .clipped()
            // gradient lives behind the text — always dark→clear regardless of
            // the app's color scheme, because the card sits on a photo
            LinearGradient(
                colors: [
                    Color.black.opacity(0.78),
                    Color.black.opacity(0.35),
                    Color.clear
                ],
                startPoint: .bottom,
                endPoint: .top
            )
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(EditorialTypography.serif(size: 16))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                    .shadow(color: .black.opacity(0.4), radius: 6, x: 0, y: 1)
                if let caption {
                    Text(caption)
                        .font(EditorialTypography.sans(size: 10, weight: .semibold))
                        .tracking(1.5)
                        .textCase(.uppercase)
                        .foregroundStyle(.white.opacity(0.78))
                        .shadow(color: .black.opacity(0.4), radius: 4, x: 0, y: 1)
                }
            }
            .padding(12)
        }
        .frame(maxWidth: .infinity)
        .overlay(
            Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: EditorialMetrics.borderWidth)
        )

        if let action {
            Button(action: action) { card }
                .buttonStyle(EditorialPressStyle())
        } else {
            card
        }
    }
}

#Preview("Photo card") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 12) {
            EditorialPhotoCard(title: "Goa Rooftop, Vol. 02", caption: "248 photos") {
                LinearGradient(
                    colors: [Color(red: 0.2, green: 0.3, blue: 0.5), Color(red: 0.4, green: 0.5, blue: 0.7)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
            EditorialPhotoCard(title: "Studio session", caption: "62 photos", aspect: 16/10) {
                LinearGradient(
                    colors: [Color(red: 0.5, green: 0.3, blue: 0.3), Color(red: 0.7, green: 0.4, blue: 0.4)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
