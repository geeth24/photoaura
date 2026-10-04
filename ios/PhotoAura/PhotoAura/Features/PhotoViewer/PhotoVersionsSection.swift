//
//  PhotoVersionsSection.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import SwiftUI
import EditorialStyle

/// Edit history for a re-edited photo in the info sheet, with the way into
/// the before and after compare view.
struct PhotoVersionsSection: View {
    let photo: Photo
    let store: PhotoVersionsStore
    @State private var comparing = false

    private var meta: PhotoMetadata { photo.fileMetadata }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Versions")
                .font(EditorialTypography.sans(size: EditorialTypography.Size.eyebrow, weight: .medium))
                .tracking(EditorialTypography.Tracking.eyebrow)
                .textCase(.uppercase)
                .foregroundStyle(EditorialColors.textMuted)
                .padding(.bottom, EditorialSpacing.small)

            if store.state.isLoading && store.state.versions.isEmpty {
                EditorialSkeleton(height: 36)
            } else if store.state.failed {
                Text("Couldn't load the earlier versions.")
                    .editorialHint()
                    .padding(.bottom, EditorialSpacing.small)
            }

            ForEach(store.state.versions.reversed()) { v in
                row(v)
            }

            if store.state.compareTo != nil {
                EditorialButton("Compare versions", style: .secondary) { comparing = true }
                    .padding(.top, EditorialSpacing.medium)
            }
        }
        .onAppear { store.send(.load) }
        .fullScreenCover(isPresented: $comparing) {
            PhotoCompareView(photo: photo, store: store)
        }
    }

    private func row(_ v: PhotoVersion) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: EditorialSpacing.small) {
                Text("v\(v.version)")
                    .font(EditorialTypography.serif(size: 17))
                    .foregroundStyle(EditorialColors.textPrimary)
                    .frame(width: 30, alignment: .leading)
                Text(label(v))
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                    .foregroundStyle(EditorialColors.textMuted)
                Spacer(minLength: 12)
                if v.version == meta.currentVersion {
                    EditorialBadge("Current", tone: .brand)
                } else if let d = ServerDate.parse(v.uploadedAt) {
                    Text(d.formatted(date: .abbreviated, time: .omitted))
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.caption, weight: .medium))
                        .foregroundStyle(EditorialColors.textPrimary)
                }
            }
            .padding(.vertical, 8)
            Divider().overlay(EditorialColors.borderSubtle)
        }
    }

    private func label(_ v: PhotoVersion) -> String {
        if v.version == 1 { return "Original delivery" }
        if let n = v.revisionNumber { return "Revision \(n)" }
        return "Re-edit"
    }
}
