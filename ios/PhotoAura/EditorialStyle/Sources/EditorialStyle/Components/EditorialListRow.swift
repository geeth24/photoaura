//
//  EditorialListRow.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialListRow<Leading: View, Trailing: View>: View {
    private let title: String
    private let subtitle: String?
    private let leading: Leading
    private let trailing: Trailing
    private let action: (() -> Void)?

    public init(
        title: String,
        subtitle: String? = nil,
        action: (() -> Void)? = nil,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.action = action
        self.leading = leading()
        self.trailing = trailing()
    }

    public var body: some View {
        let content = HStack(spacing: EditorialSpacing.medium) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(EditorialTypography.sans(size: 15, weight: .medium))
                    .foregroundStyle(EditorialColors.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let subtitle {
                    Text(subtitle)
                        .font(EditorialTypography.sans(size: 13))
                        .foregroundStyle(EditorialColors.textMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            trailing
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 4)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(EditorialColors.borderSubtle)
                .frame(height: 1)
        }

        if let action {
            Button(action: action) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }
}

public extension EditorialListRow where Trailing == EmptyView {
    init(
        title: String,
        subtitle: String? = nil,
        action: (() -> Void)? = nil,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(title: title, subtitle: subtitle, action: action, leading: leading) {
            EmptyView()
        }
    }
}

#Preview("List rows") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 0) {
            EditorialListRow(
                title: "Geeth Gunnampalli",
                subtitle: "geeth@reactiveshots.com"
            ) {
                EditorialAvatar(fullName: "Geeth Gunnampalli")
            } trailing: {
                EditorialBadge("Admin", tone: .brand)
            }
            EditorialListRow(
                title: "Sam Reactive",
                subtitle: "sam@reactiveshots.com"
            ) {
                EditorialAvatar(fullName: "Sam Reactive")
            } trailing: {
                EditorialBadge("Client")
            }
            EditorialListRow(
                title: "geeth0924@gmail.com",
                subtitle: "Verified · added May 24"
            ) {
                Image(systemName: "envelope")
                    .foregroundStyle(EditorialColors.textMuted)
                    .frame(width: 44, height: 44)
            } trailing: {
                EditorialBadge("Verified", tone: .success, icon: "checkmark")
            }
        }
        .padding(.horizontal, 20)
    }
    .preferredColorScheme(.dark)
}
