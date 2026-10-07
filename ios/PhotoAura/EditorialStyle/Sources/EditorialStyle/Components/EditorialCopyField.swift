//
//  EditorialCopyField.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// A value someone has to type somewhere else (a Zelle address, a memo),
/// with a copy button that confirms itself.
public struct EditorialCopyField: View {
    private let label: String
    private let value: String
    @State private var copied = false

    public init(_ label: String, value: String) {
        self.label = label
        self.value = value
    }

    public var body: some View {
        HStack(spacing: EditorialSpacing.small) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(EditorialTypography.sans(size: 9, weight: .medium))
                    .tracking(2.5)
                    .textCase(.uppercase)
                    .foregroundStyle(EditorialColors.textFaint)
                // shrink before truncating: half an address is no use to copy by eye
                Text(value)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundStyle(EditorialColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
            Button(action: copy) {
                HStack(spacing: 5) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 10, weight: .semibold))
                        .contentTransition(.symbolEffect(.replace))
                    Text(copied ? "Copied" : "Copy")
                        .font(EditorialTypography.sans(size: 10, weight: .semibold))
                        .tracking(1.8)
                        .textCase(.uppercase)
                }
                .foregroundStyle(copied ? EditorialColors.brand : EditorialColors.textSecondary)
                .padding(.horizontal, 10)
                .frame(height: 32)
                .overlay(
                    Rectangle().stroke(copied ? EditorialColors.brand : EditorialColors.borderDefault, lineWidth: EditorialMetrics.borderWidth)
                )
            }
            .buttonStyle(EditorialPressStyle())
            .accessibilityLabel("Copy \(label.lowercased())")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(EditorialColors.background)
        .overlay(Rectangle().stroke(EditorialColors.borderDefault, lineWidth: EditorialMetrics.borderWidth))
    }

    private func copy() {
        #if canImport(UIKit)
        UIPasteboard.general.string = value
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
        withAnimation(.easeOut(duration: 0.15)) { copied = true }
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            withAnimation(.easeOut(duration: 0.15)) { copied = false }
        }
    }
}

#Preview("Copy field") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 8) {
            EditorialCopyField("Send to", value: "zelle@reactiveshots.com")
            EditorialCopyField("Memo", value: "RS-1001 final")
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
