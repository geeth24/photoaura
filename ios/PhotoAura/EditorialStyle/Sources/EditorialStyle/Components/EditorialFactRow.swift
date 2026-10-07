//
//  EditorialFactRow.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A label and its value in a facts list (Date, Time, Location…). Stack
/// several in a VStack with spacing 1 over a hairline background.
public struct EditorialFactRow<Value: View>: View {
    private let label: String
    private let value: Value

    public init(_ label: String, @ViewBuilder value: () -> Value) {
        self.label = label
        self.value = value()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(EditorialTypography.sans(size: 10, weight: .medium))
                .tracking(2.5)
                .textCase(.uppercase)
                .foregroundStyle(EditorialColors.textMuted)
            value
                .font(EditorialTypography.sans(size: EditorialTypography.Size.body))
                .foregroundStyle(EditorialColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, EditorialSpacing.medium)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EditorialColors.surfaceElevated)
    }
}

public extension EditorialFactRow where Value == Text {
    init(_ label: String, _ value: String) {
        self.init(label) { Text(value) }
    }
}

#Preview("Facts") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 1) {
            EditorialFactRow("Event", "Wedding")
            EditorialFactRow("Date", "Saturday, November 14, 2026")
            EditorialFactRow("Time", "4:00 PM – 10:00 PM")
        }
        .background(EditorialColors.borderSubtle)
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
