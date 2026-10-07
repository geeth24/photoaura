//
//  EditorialSteps.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A numbered progress list: finished steps get a check, the next one is
/// outlined in brand, the rest stay faint.
public struct EditorialSteps: View {
    private let steps: [String]
    private let done: Int
    private let showsNext: Bool

    /// `done` is how many steps are finished; `showsNext` highlights the one after.
    public init(_ steps: [String], done: Int, showsNext: Bool = true) {
        self.steps = steps
        self.done = done
        self.showsNext = showsNext
    }

    public var body: some View {
        VStack(spacing: 1) {
            ForEach(Array(steps.enumerated()), id: \.offset) { i, label in
                row(i, label)
            }
        }
        .background(EditorialColors.borderSubtle)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: EditorialMetrics.borderWidth))
    }

    private func row(_ i: Int, _ label: String) -> some View {
        let isDone = i < done
        let isNext = showsNext && i == done
        return HStack(spacing: EditorialSpacing.small) {
            ZStack {
                if isDone {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(EditorialColors.background)
                } else {
                    Text("\(i + 1)")
                        .font(EditorialTypography.sans(size: 11, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(isNext ? EditorialColors.brand : EditorialColors.textFaint)
                }
            }
            .frame(width: 24, height: 24)
            .background(isDone ? EditorialColors.brand : .clear)
            .overlay(
                Rectangle().stroke(
                    isDone || isNext ? EditorialColors.brand : EditorialColors.borderDefault,
                    lineWidth: EditorialMetrics.borderWidth
                )
            )

            Text(label)
                .font(EditorialTypography.sans(size: 11, weight: .medium))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(isDone ? EditorialColors.textPrimary : isNext ? EditorialColors.brand : EditorialColors.textFaint)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, EditorialSpacing.medium)
        .padding(.vertical, 10)
        .background(isNext ? EditorialColors.surfaceCard : EditorialColors.surfaceElevated)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(isDone ? EditorialColors.brand : isNext ? EditorialColors.brand.opacity(0.4) : .clear)
                .frame(width: 2)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label), \(isDone ? "done" : isNext ? "next" : "not yet")")
    }
}

#Preview("Steps") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        EditorialSteps(["Signed", "Date secured", "Event day", "Gallery delivered", "Paid in full"], done: 2)
            .padding(20)
    }
    .preferredColorScheme(.dark)
}
