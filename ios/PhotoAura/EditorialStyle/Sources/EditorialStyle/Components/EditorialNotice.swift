//
//  EditorialNotice.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A callout with a brand bar down its left edge: a locked-gallery note,
/// a message from the photographer, a "this changed" heads-up.
public struct EditorialNotice<Footer: View>: View {
    private let systemImage: String?
    private let eyebrow: String?
    private let title: String?
    private let message: String?
    private let footer: Footer

    public init(
        systemImage: String? = nil,
        eyebrow: String? = nil,
        title: String? = nil,
        message: String? = nil,
        @ViewBuilder footer: () -> Footer
    ) {
        self.systemImage = systemImage
        self.eyebrow = eyebrow
        self.title = title
        self.message = message
        self.footer = footer()
    }

    public var body: some View {
        HStack(alignment: .top, spacing: EditorialSpacing.small) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(EditorialColors.brand)
                    .padding(.top, 2)
            }
            VStack(alignment: .leading, spacing: 6) {
                if let eyebrow {
                    Text(eyebrow)
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .tracking(2.5)
                        .textCase(.uppercase)
                        .foregroundStyle(EditorialColors.textMuted)
                }
                if let title {
                    Text(title)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.body))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let message {
                    Text(message)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                        .foregroundStyle(title == nil ? EditorialColors.textSecondary : EditorialColors.textMuted)
                        .lineSpacing(EditorialTypography.LineSpacing.hint)
                        .fixedSize(horizontal: false, vertical: true)
                }
                footer
            }
            Spacer(minLength: 0)
        }
        .padding(EditorialSpacing.medium)
        .padding(.leading, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: EditorialMetrics.borderWidth))
        .overlay(alignment: .leading) {
            Rectangle().fill(EditorialColors.brand).frame(width: 2)
        }
    }
}

public extension EditorialNotice where Footer == EmptyView {
    init(systemImage: String? = nil, eyebrow: String? = nil, title: String? = nil, message: String? = nil) {
        self.init(systemImage: systemImage, eyebrow: eyebrow, title: title, message: message) { EmptyView() }
    }
}

#Preview("Notice") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 16) {
            EditorialNotice(
                systemImage: "lock",
                title: "Gallery preview — full-resolution downloads unlock after your final payment.",
                message: "Until then you're seeing watermarked previews."
            )
            EditorialNotice(eyebrow: "From your photographer", message: "Parking is behind the venue.")
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
