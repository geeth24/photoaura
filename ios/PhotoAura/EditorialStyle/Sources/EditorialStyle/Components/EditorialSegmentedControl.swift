//
//  EditorialSegmentedControl.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialSegmentedControl<Value: Hashable>: View {
    private let items: [(label: String, value: Value)]
    @Binding private var selection: Value

    public init(items: [(String, Value)], selection: Binding<Value>) {
        self.items = items
        self._selection = selection
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { idx, item in
                let active = item.value == selection
                Button {
                    selection = item.value
                } label: {
                    Text(item.label)
                        .font(EditorialTypography.sans(size: 11, weight: .medium))
                        .tracking(1.7)
                        .textCase(.uppercase)
                        .foregroundStyle(active ? EditorialColors.brand : EditorialColors.textMuted)
                        .padding(.horizontal, 16)
                        .frame(height: 36)
                        .frame(maxWidth: .infinity)
                        .background(active ? EditorialColors.surfaceElevated : Color.clear)
                }
                .buttonStyle(.plain)
                if idx < items.count - 1 {
                    Rectangle()
                        .fill(EditorialColors.borderHairline)
                        .frame(width: 1, height: 36)
                }
            }
        }
        .overlay(
            Rectangle().stroke(EditorialColors.borderHairline, lineWidth: EditorialMetrics.borderWidth)
        )
    }
}

#Preview("Segmented control") {
    @Previewable @State var orientation = "all"
    return ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 16) {
            EditorialSegmentedControl(
                items: [("All", "all"), ("Portrait", "portrait"), ("Landscape", "landscape")],
                selection: $orientation
            )
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
