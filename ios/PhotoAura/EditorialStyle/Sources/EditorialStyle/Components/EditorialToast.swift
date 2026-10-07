//
//  EditorialToast.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A short confirmation that floats over the top of a screen ("Signed",
/// "Payment recorded"). The caller decides when it goes away.
public struct EditorialToast: View {
    public enum Tone: Sendable { case success, error }

    private let message: String
    private let tone: Tone

    public init(_ message: String, tone: Tone = .success) {
        self.message = message
        self.tone = tone
    }

    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: tone == .success ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tone == .success ? EditorialColors.brand : EditorialColors.error)
            Text(message)
                .font(EditorialTypography.sans(size: EditorialTypography.Size.caption, weight: .medium))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.black.opacity(0.82))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.1), lineWidth: 1))
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .accessibilityElement(children: .combine)
    }
}

#Preview("Toast") {
    ZStack(alignment: .top) {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 12) {
            EditorialToast("Signed. A copy is on its way to your inbox.")
            EditorialToast("Couldn't record the payment", tone: .error)
        }
        .padding(.top, 20)
    }
    .preferredColorScheme(.dark)
}
