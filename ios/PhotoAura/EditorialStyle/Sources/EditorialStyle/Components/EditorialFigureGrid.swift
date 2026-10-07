//
//  EditorialFigureGrid.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// One labelled number in a figure grid, e.g. a money total.
public struct EditorialFigure: Identifiable, Hashable, Sendable {
    public let label: String
    public let value: String
    public let footnote: String?
    // the figure to look at first; drawn in brand
    public let emphasized: Bool

    public var id: String { label }

    public init(_ label: String, _ value: String, footnote: String? = nil, emphasized: Bool = false) {
        self.label = label
        self.value = value
        self.footnote = footnote
        self.emphasized = emphasized
    }
}

/// Figures in a hairline grid, rows sharing a height, like the web's money rows.
public struct EditorialFigureGrid: View {
    private let figures: [EditorialFigure]
    private let columns: Int
    private let valueSize: CGFloat

    public init(_ figures: [EditorialFigure], columns: Int = 2, valueSize: CGFloat = 24) {
        self.figures = figures
        self.columns = max(1, columns)
        self.valueSize = valueSize
    }

    public var body: some View {
        Grid(horizontalSpacing: 1, verticalSpacing: 1) {
            ForEach(rows.indices, id: \.self) { r in
                GridRow {
                    ForEach(rows[r]) { figure in
                        cell(figure)
                    }
                    // pad a short last row so its cells keep their width
                    ForEach(0..<(columns - rows[r].count), id: \.self) { _ in
                        EditorialColors.surfaceElevated
                    }
                }
            }
        }
        .background(EditorialColors.borderSubtle)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: EditorialMetrics.borderWidth))
    }

    private var rows: [[EditorialFigure]] {
        stride(from: 0, to: figures.count, by: columns).map { Array(figures[$0..<min($0 + columns, figures.count)]) }
    }

    private func cell(_ f: EditorialFigure) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(f.label)
                .font(EditorialTypography.sans(size: 10, weight: .medium))
                .tracking(2.5)
                .textCase(.uppercase)
                .foregroundStyle(EditorialColors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(f.value)
                .font(EditorialTypography.serif(size: valueSize))
                .monospacedDigit()
                .foregroundStyle(f.emphasized ? EditorialColors.brand : EditorialColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let footnote = f.footnote {
                Text(footnote)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                    .foregroundStyle(EditorialColors.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, EditorialSpacing.medium)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(EditorialColors.surfaceElevated)
    }
}

#Preview("Figure grid") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        EditorialFigureGrid([
            EditorialFigure("Total fee", "$1,350.00"),
            EditorialFigure("Extras", "$0.00"),
            EditorialFigure("Paid", "$675.00"),
            EditorialFigure("Balance", "$675.00", emphasized: true),
        ])
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
