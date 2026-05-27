//
//  EditorialConfirmSheet.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI

// Bottom sheet for destructive confirmations — sign out, delete account,
// etc. Same editorial look across every "are you sure?" moment instead of
// the system popover/alert SwiftUI picks based on device class.
public struct EditorialConfirmSheet: View {
    public let title: String
    public let message: String?
    public let systemImage: String?
    public let primaryLabel: String
    public let isDestructive: Bool
    public let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss

    public init(
        title: String,
        message: String? = nil,
        systemImage: String? = nil,
        primaryLabel: String,
        isDestructive: Bool = false,
        onConfirm: @escaping () -> Void
    ) {
        self.title = title
        self.message = message
        self.systemImage = systemImage
        self.primaryLabel = primaryLabel
        self.isDestructive = isDestructive
        self.onConfirm = onConfirm
    }

    public var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()

            VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 28, weight: .regular))
                        .foregroundStyle(isDestructive ? EditorialColors.error : EditorialColors.brand)
                        .padding(.bottom, EditorialSpacing.xSmall)
                }

                VStack(alignment: .leading, spacing: EditorialSpacing.small) {
                    Text(title).editorialHeading()
                    if let message {
                        Text(message).editorialSubtitle()
                    }
                }

                Spacer(minLength: EditorialSpacing.medium)

                VStack(spacing: EditorialSpacing.small) {
                    primaryButton
                    EditorialButton("Cancel", style: .ghost) {
                        dismiss()
                    }
                }
            }
            .padding(.horizontal, EditorialSpacing.screenGutter)
            .padding(.top, EditorialSpacing.xLarge)
            .padding(.bottom, EditorialSpacing.medium)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground(EditorialColors.background)
    }

    private var primaryButton: some View {
        Button {
            onConfirm()
            dismiss()
        } label: {
            HStack {
                Text(primaryLabel)
                    .font(.system(size: 12, weight: .bold))
                    .tracking(2.4)
                    .textCase(.uppercase)
                    .foregroundStyle(isDestructive ? EditorialColors.error : EditorialColors.background)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 28)
            .frame(maxWidth: .infinity)
            .background(isDestructive ? Color.clear : EditorialColors.brand)
            .overlay(
                Rectangle()
                    .stroke(
                        isDestructive ? EditorialColors.error.opacity(0.5) : .clear,
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview("Sign out") {
    Color.gray
        .sheet(isPresented: .constant(true)) {
            EditorialConfirmSheet(
                title: "Sign out?",
                message: "You'll need a new sign-in link to come back.",
                systemImage: "rectangle.portrait.and.arrow.right",
                primaryLabel: "Sign out",
                isDestructive: true
            ) {}
        }
}

#Preview("Delete account") {
    Color.gray
        .sheet(isPresented: .constant(true)) {
            EditorialConfirmSheet(
                title: "Delete your account?",
                message: "This permanently removes your account, access to galleries shared with you, and your linked emails. This can't be undone.",
                systemImage: "exclamationmark.triangle",
                primaryLabel: "Delete my account",
                isDestructive: true
            ) {}
        }
}
