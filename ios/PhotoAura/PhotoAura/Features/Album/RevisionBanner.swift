//
//  RevisionBanner.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import SwiftUI
import EditorialStyle

/// Sits above the grid once the photographer has pushed re-edits, with a
/// toggle to see just the photos that changed.
struct RevisionBanner: View {
    let revision: AlbumRevision
    let count: Int
    let onlyRevised: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.small) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(EditorialColors.brand)
                Text("\(revision.title) · \(count) \(count == 1 ? "photo" : "photos") updated")
                    .editorialEyebrow(color: EditorialColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            if let note = revision.note {
                Text(note)
                    .font(EditorialTypography.serif(size: 19))
                    .foregroundStyle(EditorialColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button(action: onToggle) {
                HStack(spacing: 6) {
                    Image(systemName: onlyRevised ? "checkmark" : "line.3.horizontal.decrease")
                        .font(.system(size: 10, weight: .bold))
                        .contentTransition(.symbolEffect(.replace))
                    Text(onlyRevised ? "Showing updated" : "Show only updated")
                        .font(EditorialTypography.sans(size: 10, weight: .semibold))
                        .tracking(1.6)
                        .textCase(.uppercase)
                }
                .foregroundStyle(onlyRevised ? EditorialColors.background : EditorialColors.brand)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(onlyRevised ? EditorialColors.brand : .clear)
                .overlay(Rectangle().stroke(EditorialColors.borderAccent, lineWidth: onlyRevised ? 0 : 1))
            }
            .buttonStyle(EditorialPressStyle())
            .padding(.top, 4)
            .accessibilityAddTraits(onlyRevised ? .isSelected : [])
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(EditorialSpacing.medium)
        .padding(.leading, 2)
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
        .overlay(alignment: .leading) {
            Rectangle().fill(EditorialColors.brand).frame(width: 2)
        }
        .animation(.smooth(duration: 0.2), value: onlyRevised)
    }
}
