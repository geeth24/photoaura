//
//  PhotoCompareView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import SwiftUI
import EditorialStyle

/// Before and after of a re-edited photo, one on top of the other, with a
/// divider to drag between them. The earlier version shows on the left.
struct PhotoCompareView: View {
    let photo: Photo
    // the info sheet already has the history loaded; the viewer doesn't
    var store: PhotoVersionsStore? = nil

    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var owned: PhotoVersionsStore?
    @State private var position: CGFloat = 0.5

    private var versions: PhotoVersionsStore? { store ?? owned }
    private var meta: PhotoMetadata { photo.fileMetadata }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                Spacer(minLength: EditorialSpacing.medium)
                stage
                Spacer(minLength: EditorialSpacing.medium)
                bottomBar
            }
        }
        .environment(\.colorScheme, .dark)
        .foregroundStyle(.white)
        .onAppear {
            if store == nil, owned == nil, let id = meta.id {
                owned = PhotoVersionsStore(api: api, photoId: id, currentVersion: meta.currentVersion)
            }
            versions?.send(.load)
        }
    }

    // MARK: - stage

    private var aspect: CGFloat {
        meta.width > 0 && meta.height > 0 ? CGFloat(meta.width) / CGFloat(meta.height) : 1
    }

    private var before: PhotoVersion? { versions?.state.compareTo }

    // both versions fit the current photo's frame, so the divider lines up even
    // if an edit changed the crop
    private var stage: some View {
        Color.clear
            .aspectRatio(aspect, contentMode: .fit)
            .overlay {
                PhotoPage(
                    thumbnailURL: ImageURLHelper.autoOriented(from: photo.compressedImage, width: 750),
                    fullURL: ImageURLHelper.autoOriented(from: photo.image, width: 2048)
                )
            }
            .overlay {
                if let before {
                    GeometryReader { geo in
                        beforeLayer(before, size: geo.size)
                    }
                } else if versions?.state.isLoading ?? true {
                    ProgressView().tint(.white)
                }
            }
            .overlay(alignment: .topLeading) {
                if let before { EditorialPhotoTag("v\(before.version)").padding(EditorialSpacing.xSmall) }
            }
            .overlay(alignment: .topTrailing) {
                EditorialPhotoTag("v\(meta.currentVersion)").padding(EditorialSpacing.xSmall)
            }
            .clipped()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(before.map { "Compare v\($0.version) with v\(meta.currentVersion)" } ?? "Loading versions")
            .accessibilityValue(before.map { "\(Int((position * 100).rounded())) percent v\($0.version)" } ?? "")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: position = min(1, position + 0.1)
                case .decrement: position = max(0, position - 0.1)
                @unknown default: break
                }
            }
    }

    private func beforeLayer(_ before: PhotoVersion, size: CGSize) -> some View {
        let x = size.width * position
        return ZStack(alignment: .topLeading) {
            PhotoPage(
                thumbnailURL: before.compressedImage.map { ImageURLHelper.autoOriented(from: $0, width: 750) },
                fullURL: before.image.map { ImageURLHelper.autoOriented(from: $0, width: 2048) }
            )
            // a fresh page per version, or the last one's cached image lingers
            .id(before.version)
            .mask(alignment: .leading) {
                Rectangle().frame(width: x)
            }

            Rectangle()
                .fill(.white)
                .frame(width: 1.5, height: size.height)
                .shadow(color: .black.opacity(0.35), radius: 3)
                .position(x: x, y: size.height / 2)

            Image(systemName: "chevron.left.chevron.right")
                .font(.system(size: 13, weight: .bold))
                .frame(width: 40, height: 40)
                .editorialGlass(in: Circle())
                .overlay(Circle().stroke(.white.opacity(0.5), lineWidth: 1))
                .position(x: x, y: size.height / 2)
        }
        .frame(width: size.width, height: size.height)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { v in move(to: v.location.x / max(size.width, 1)) }
        )
    }

    private func move(to next: CGFloat) {
        let next = min(max(next, 0), 1)
        // a tick as the handle crosses the middle, where both halves are even
        if (position < 0.5) != (next < 0.5) {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
        position = next
    }

    // MARK: - chrome

    private var topBar: some View {
        ZStack {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 38, height: 38)
                }
                .editorialGlass(in: Circle(), interactive: true)
                .accessibilityLabel("Close")
                Spacer()
            }

            VStack(spacing: 1) {
                Text("Compare")
                    .font(EditorialTypography.sans(size: 15, weight: .semibold))
                Text(before.map { "v\($0.version) · v\(meta.currentVersion)" } ?? meta.filename)
                    .font(EditorialTypography.sans(size: 11))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .lineLimit(1)
            .frame(maxWidth: 200)
        }
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .padding(.top, EditorialSpacing.xSmall)
    }

    @ViewBuilder
    private var bottomBar: some View {
        VStack(spacing: EditorialSpacing.medium) {
            if let versions, versions.state.earlier.count > 1, let before {
                VStack(alignment: .leading, spacing: EditorialSpacing.xSmall) {
                    EditorialEyebrow("Compare against", color: .white.opacity(0.6))
                    EditorialSegmentedControl(
                        items: versions.state.earlier.map { (label(for: $0), $0.version) },
                        selection: Binding(get: { before.version }, set: { versions.send(.select($0)) })
                    )
                }
            }

            Text(hint)
                .editorialHint(color: .white.opacity(0.6))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .padding(.bottom, EditorialSpacing.medium)
        .frame(minHeight: 60)
    }

    private var hint: String {
        if before != nil { return "Drag the divider to compare" }
        if versions?.state.failed == true || meta.id == nil { return "Couldn't load the earlier version." }
        return " "
    }

    private func label(for v: PhotoVersion) -> String {
        v.version == 1 ? "v1 · Original" : "v\(v.version)"
    }
}
