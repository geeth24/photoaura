//
//  EditorialButton.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public enum EditorialButtonStyle {
    case primary
    case secondary
    case ghost
}

public struct EditorialButton: View {
    private let title: String
    private let style: EditorialButtonStyle
    private let isLoading: Bool
    private let isDisabled: Bool
    private let action: () -> Void

    public init(
        _ title: String,
        style: EditorialButtonStyle = .primary,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: EditorialSpacing.xSmall) {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(labelColor)
                }
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .tracking(EditorialTypography.Tracking.button)
                    .textCase(.uppercase)
                    .foregroundStyle(labelColor)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 28)
            .frame(maxWidth: .infinity)
            .background(fillColor)
            .overlay(
                Rectangle()
                    .stroke(borderColor, lineWidth: borderWidth)
            )
        }
        .buttonStyle(EditorialPressStyle())
        .disabled(isDisabled || isLoading)
    }

    // disabled buttons drop to a hollow outline — clear "not ready yet"
    // signal instead of a washed-out brand pill that looks like a bug
    private var fillColor: Color {
        if isDisabled {
            return style == .primary ? .clear : EditorialColors.surfaceElevated
        }
        switch style {
        case .primary: return EditorialColors.brand
        case .secondary: return EditorialColors.surfaceElevated
        case .ghost: return .clear
        }
    }

    private var labelColor: Color {
        if isDisabled { return EditorialColors.textMuted }
        switch style {
        case .primary: return EditorialColors.background
        case .secondary, .ghost: return EditorialColors.textPrimary
        }
    }

    private var borderColor: Color {
        if isDisabled { return EditorialColors.borderDefault }
        switch style {
        case .primary: return .clear
        case .secondary, .ghost: return EditorialColors.borderDefault
        }
    }

    private var borderWidth: CGFloat {
        if isDisabled { return EditorialMetrics.borderWidth }
        return style == .primary ? 0 : EditorialMetrics.borderWidth
    }
}

public struct EditorialPressStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? EditorialMetrics.pressScale : 1)
            .animation(.easeOut(duration: EditorialMetrics.pressDuration), value: configuration.isPressed)
    }
}

#Preview("Buttons") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 16) {
            EditorialButton("Primary action") {}
            EditorialButton("Secondary", style: .secondary) {}
            EditorialButton("Ghost", style: .ghost) {}
            EditorialButton("Loading…", isLoading: true) {}
            EditorialButton("Disabled", isDisabled: true) {}
        }
        .padding(32)
    }
    .preferredColorScheme(.dark)
}
