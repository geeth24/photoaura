//
//  EditorialOptionButton.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// One choice in a small grid of choices (a payment method, an overtime
/// length). Selected reads as a brand outline on a brand tint.
public struct EditorialOptionButton: View {
    private let title: String
    private let detail: String?
    private let isSelected: Bool
    private let action: () -> Void

    public init(_ title: String, detail: String? = nil, isSelected: Bool, action: @escaping () -> Void) {
        self.title = title
        self.detail = detail
        self.isSelected = isSelected
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text(title)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.caption, weight: .medium))
                    .foregroundStyle(isSelected ? EditorialColors.textPrimary : EditorialColors.textSecondary)
                if let detail {
                    Text(detail)
                        .font(EditorialTypography.sans(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(EditorialColors.textMuted)
                }
            }
            .frame(maxWidth: .infinity, minHeight: detail == nil ? 42 : 58)
            .background(isSelected ? EditorialColors.brand.opacity(0.1) : .clear)
            .overlay(
                Rectangle().stroke(isSelected ? EditorialColors.brand : EditorialColors.borderDefault, lineWidth: EditorialMetrics.borderWidth)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview("Options") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        HStack(spacing: 6) {
            EditorialOptionButton("Zelle", isSelected: true) {}
            EditorialOptionButton("Cash", isSelected: false) {}
            EditorialOptionButton("1 hr", detail: "$150.00", isSelected: false) {}
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
