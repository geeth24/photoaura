//
//  EditorialBadge.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public enum EditorialBadgeTone {
    case neutral
    case brand
    case success
    case warning
    case danger
    case muted
}

public struct EditorialBadge: View {
    private let text: String
    private let tone: EditorialBadgeTone
    private let icon: String?

    public init(_ text: String, tone: EditorialBadgeTone = .neutral, icon: String? = nil) {
        self.text = text
        self.tone = tone
        self.icon = icon
    }

    public var body: some View {
        HStack(spacing: 4) {
            if let icon {
                Image(systemName: icon).font(.system(size: 9, weight: .semibold))
            }
            Text(text)
                .font(EditorialTypography.sans(size: 10, weight: .medium))
                .tracking(2)
                .textCase(.uppercase)
                .lineLimit(1)
        }
        .fixedSize(horizontal: true, vertical: false)
        .foregroundStyle(textColor)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .overlay(
            Rectangle()
                .stroke(borderColor, lineWidth: EditorialMetrics.borderWidth)
        )
    }

    private var textColor: Color {
        switch tone {
        case .neutral: return EditorialColors.textSecondary
        case .brand: return EditorialColors.brand
        case .success: return EditorialColors.success
        case .warning: return EditorialColors.warning
        case .danger: return EditorialColors.error
        case .muted: return EditorialColors.textMuted
        }
    }

    private var borderColor: Color {
        switch tone {
        case .neutral, .muted: return EditorialColors.borderHairline
        case .brand: return EditorialColors.borderAccent
        case .success: return EditorialColors.success.opacity(0.4)
        case .warning: return EditorialColors.warning.opacity(0.4)
        case .danger: return EditorialColors.error.opacity(0.4)
        }
    }
}

#Preview("Badges") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                EditorialBadge("Primary")
                EditorialBadge("Shared", tone: .brand)
                EditorialBadge("Upload Enabled", tone: .brand)
            }
            HStack(spacing: 8) {
                EditorialBadge("Verified", tone: .success, icon: "checkmark")
                EditorialBadge("Pending", tone: .muted, icon: "clock")
                EditorialBadge("Failed", tone: .danger, icon: "exclamationmark")
            }
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
