//
//  EditorialFilterChip.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A list filter with its count. Lay several in a horizontal scroll.
public struct EditorialFilterChip: View {
    private let title: String
    private let count: Int?
    private let isActive: Bool
    private let action: () -> Void

    public init(_ title: String, count: Int? = nil, isActive: Bool, action: @escaping () -> Void) {
        self.title = title
        self.count = count
        self.isActive = isActive
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                    .font(EditorialTypography.sans(size: 10, weight: .medium))
                    .tracking(2)
                    .textCase(.uppercase)
                    .foregroundStyle(isActive ? EditorialColors.brand : EditorialColors.textSecondary)
                if let count {
                    Text("\(count)")
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(EditorialColors.textFaint)
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .overlay(
                Rectangle().stroke(isActive ? EditorialColors.brand : EditorialColors.borderDefault, lineWidth: EditorialMetrics.borderWidth)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }
}

#Preview("Filter chips") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        HStack(spacing: 8) {
            EditorialFilterChip("Active", count: 4, isActive: true) {}
            EditorialFilterChip("Drafts", count: 1, isActive: false) {}
            EditorialFilterChip("All", isActive: false) {}
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
