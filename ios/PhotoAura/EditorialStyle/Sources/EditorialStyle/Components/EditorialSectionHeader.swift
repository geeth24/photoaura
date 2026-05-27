//
//  EditorialSectionHeader.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialSectionHeader: View {
    private let eyebrow: String?
    private let title: String?
    private let subtitle: String?
    private let style: Style

    public enum Style {
        case page    // big serif heading with eyebrow accent line
        case section // smaller serif heading, less padding
    }

    public init(
        title: String? = nil,
        eyebrow: String? = nil,
        subtitle: String? = nil,
        style: Style = .page
    ) {
        self.title = title
        self.eyebrow = eyebrow
        self.subtitle = subtitle
        self.style = style
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.small) {
            if let eyebrow {
                HStack(spacing: EditorialSpacing.small) {
                    Rectangle()
                        .fill(EditorialColors.brand)
                        .frame(width: 48, height: 1)
                    Text(eyebrow)
                        .editorialEyebrow(color: EditorialColors.textMuted)
                }
            }
            if let title {
                if style == .page {
                    Text(title).editorialDisplay()
                } else {
                    Text(title).editorialHeading()
                }
            }
            if let subtitle {
                Text(subtitle).editorialSubtitle()
            }
        }
    }
}

#Preview("Section headers") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(alignment: .leading, spacing: 40) {
            EditorialSectionHeader(
                title: "Welcome back, Geeth",
                eyebrow: "Overview",
                subtitle: "A quiet snapshot of your studio."
            )
            EditorialSectionHeader(
                title: "Recent albums",
                eyebrow: "Library",
                style: .section
            )
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .preferredColorScheme(.dark)
}
