//
//  EditorialPanel.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A titled section: an eyebrow header row (with optional actions on the
/// right) over a padded body. The web dashboard's Card.
public struct EditorialPanel<Content: View, Accessory: View>: View {
    private let title: String
    private let systemImage: String?
    private let content: Content
    private let accessory: Accessory

    public init(
        _ title: String,
        systemImage: String? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder accessory: () -> Accessory
    ) {
        self.title = title
        self.systemImage = systemImage
        self.content = content()
        self.accessory = accessory()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: EditorialSpacing.small) {
                HStack(spacing: 8) {
                    if let systemImage {
                        Image(systemName: systemImage)
                            .font(.system(size: 11, weight: .medium))
                    }
                    Text(title)
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .tracking(3.5)
                        .textCase(.uppercase)
                        .lineLimit(1)
                }
                .foregroundStyle(EditorialColors.textMuted)
                Spacer(minLength: 0)
                accessory
            }
            .padding(.horizontal, EditorialSpacing.medium)
            .frame(minHeight: 48)
            .overlay(alignment: .bottom) {
                Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1)
            }

            content
                .padding(EditorialSpacing.medium)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: EditorialMetrics.borderWidth))
    }
}

public extension EditorialPanel where Accessory == EmptyView {
    init(_ title: String, systemImage: String? = nil, @ViewBuilder content: () -> Content) {
        self.init(title, systemImage: systemImage, content: content) { EmptyView() }
    }
}

/// The small outlined action used in panel headers and rows ("Invoice", "Undo").
public struct EditorialSmallButton: View {
    public enum Style { case outline, filled, quiet, destructive }

    private let title: String
    private let systemImage: String?
    private let style: Style
    private let isLoading: Bool
    private let action: () -> Void

    public init(_ title: String, systemImage: String? = nil, style: Style = .outline, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.style = style
        self.isLoading = isLoading
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView().controlSize(.mini).tint(foreground)
                } else if let systemImage {
                    Image(systemName: systemImage).font(.system(size: 10, weight: .semibold))
                }
                if !title.isEmpty {
                    Text(title)
                        .font(EditorialTypography.sans(size: 10, weight: .semibold))
                        .tracking(1.8)
                        .textCase(.uppercase)
                        .lineLimit(1)
                }
            }
            .foregroundStyle(foreground)
            .padding(.horizontal, title.isEmpty ? 8 : 12)
            .frame(minWidth: 32, minHeight: 32)
            .background(style == .filled ? EditorialColors.brand : .clear)
            .overlay(Rectangle().stroke(border, lineWidth: EditorialMetrics.borderWidth))
            .contentShape(Rectangle())
        }
        .buttonStyle(EditorialPressStyle())
        .disabled(isLoading)
    }

    private var foreground: Color {
        switch style {
        case .outline: return EditorialColors.textSecondary
        case .filled: return EditorialColors.background
        case .quiet: return EditorialColors.textMuted
        case .destructive: return EditorialColors.error
        }
    }

    private var border: Color {
        switch style {
        case .outline: return EditorialColors.borderDefault
        case .filled: return EditorialColors.brand
        case .quiet: return .clear
        case .destructive: return EditorialColors.error.opacity(0.4)
        }
    }
}

#Preview("Panel") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        EditorialPanel("Payments", systemImage: "calendar") {
            Text("Three payments, 10/40/50 of the fee.").editorialSubtitle()
        } accessory: {
            EditorialSmallButton("Invoice", systemImage: "arrow.down.to.line") {}
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
