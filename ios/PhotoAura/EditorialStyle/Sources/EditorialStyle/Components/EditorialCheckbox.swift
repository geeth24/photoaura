//
//  EditorialCheckbox.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A square checkbox with its label; the whole row toggles.
public struct EditorialCheckbox: View {
    @Binding private var isOn: Bool
    private let label: String

    public init(_ label: String, isOn: Binding<Bool>) {
        self.label = label
        self._isOn = isOn
    }

    public var body: some View {
        Button {
            isOn.toggle()
        } label: {
            HStack(alignment: .top, spacing: EditorialSpacing.small) {
                ZStack {
                    if isOn {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(EditorialColors.background)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .frame(width: 22, height: 22)
                .background(isOn ? EditorialColors.brand : EditorialColors.surfaceElevated)
                .overlay(
                    Rectangle().stroke(isOn ? EditorialColors.brand : EditorialColors.borderStrong, lineWidth: EditorialMetrics.borderWidth)
                )
                .padding(.top, 1)

                Text(label)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.body))
                    .foregroundStyle(EditorialColors.textPrimary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: isOn)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

#Preview("Checkbox") {
    @Previewable @State var on = false
    return ZStack {
        EditorialColors.background.ignoresSafeArea()
        EditorialCheckbox("I agree to sign this agreement electronically.", isOn: $on)
            .padding(24)
    }
    .preferredColorScheme(.dark)
}
