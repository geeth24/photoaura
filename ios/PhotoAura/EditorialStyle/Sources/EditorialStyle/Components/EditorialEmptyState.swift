//
//  EditorialEmptyState.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialEmptyState: View {
    private let systemImage: String
    private let title: String
    private let subtitle: String?
    private let action: (() -> Void)?
    private let actionTitle: String?

    public init(
        systemImage: String,
        title: String,
        subtitle: String? = nil,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.systemImage = systemImage
        self.title = title
        self.subtitle = subtitle
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        VStack(spacing: EditorialSpacing.small) {
            Image(systemName: systemImage)
                .font(.system(size: 24, weight: .regular))
                .foregroundStyle(EditorialColors.textHint)
                .padding(.bottom, 4)
            Text(title).editorialHeading()
            if let subtitle {
                Text(subtitle)
                    .editorialSubtitle()
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                EditorialButton(actionTitle, style: .secondary, action: action)
                    .padding(.top, EditorialSpacing.small)
                    .frame(maxWidth: 240)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 64)
        .padding(.horizontal, 24)
        .overlay(
            DashedBorder()
        )
    }

    private struct DashedBorder: View {
        var body: some View {
            Rectangle()
                .strokeBorder(
                    EditorialColors.borderHairline,
                    style: StrokeStyle(lineWidth: 1, dash: [4, 4])
                )
        }
    }
}

#Preview("Empty state") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 24) {
            EditorialEmptyState(
                systemImage: "photo.on.rectangle",
                title: "No albums yet",
                subtitle: "Create your first collection to get started.",
                actionTitle: "New album"
            ) {}
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
