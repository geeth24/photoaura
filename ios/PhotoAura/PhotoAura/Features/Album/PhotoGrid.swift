//
//  PhotoGrid.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 9/29/26.
//

import SwiftUI
import EditorialStyle

/// Square, edge-to-edge photo grid, same as the web gallery. Pinch to step
/// between 5, 3 and 2 columns; the choice sticks across albums. Tapping a tile
/// hands back a target the viewer zooms out of.
struct PhotoGrid: View {
    let photos: [Photo]
    let transition: Namespace.ID
    let onOpen: (PhotoTarget) -> Void

    // densest first; the middle step is the default
    static var steps: [Int] { [5, 3, 2] }
    @AppStorage("gridDensity") private var step = 1
    // a pinch lifts two fingers off a tile; that isn't a tap
    @State private var pinching = false
    @State private var pinchEnded = Date.distantPast

    var body: some View {
        LazyVGrid(columns: Self.columns(for: step), spacing: 2) {
            ForEach(Array(photos.enumerated()), id: \.element.id) { idx, photo in
                PhotoTile(photo: photo)
                    .matchedTransitionSource(id: photo.id, in: transition)
                    .onTapGesture {
                        guard !pinching, Date.now.timeIntervalSince(pinchEnded) > 0.3 else { return }
                        onOpen(PhotoTarget(index: idx, sourceID: photo.id))
                    }
                    .accessibilityAddTraits(.isButton)
            }
        }
        .animation(.smooth(duration: 0.35), value: step)
        .highPriorityGesture(
            MagnifyGesture()
                .onChanged { _ in pinching = true }
                .onEnded { value in
                    pinching = false
                    pinchEnded = .now
                    // spread = bigger tiles = fewer columns
                    let next = value.magnification > 1.15 ? step + 1 : value.magnification < 0.87 ? step - 1 : step
                    guard next != step, Self.steps.indices.contains(next) else { return }
                    UISelectionFeedbackGenerator().selectionChanged()
                    step = next
                }
        )
    }

    static func columns(for step: Int) -> [GridItem] {
        let n = steps[min(max(step, 0), steps.count - 1)]
        return Array(repeating: GridItem(.flexible(), spacing: 2), count: n)
    }
}

/// Loading placeholder with the grid's current density.
struct PhotoGridSkeleton: View {
    @AppStorage("gridDensity") private var step = 1

    var body: some View {
        LazyVGrid(columns: PhotoGrid.columns(for: step), spacing: 2) {
            ForEach(0..<15, id: \.self) { _ in EditorialSkeleton(aspect: 1) }
        }
    }
}

/// One square tile: cached thumbnail filling the square, play badge on videos.
struct PhotoTile: View {
    let photo: Photo

    var body: some View {
        EditorialColors.surfaceElevated
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                CachedImage(url: ImageURLHelper.autoOriented(from: photo.compressedImage, width: 750), contentMode: .fill)
            }
            .overlay { if photo.isVideo { VideoPlayBadge() } }
            .clipped()
            .contentShape(Rectangle())
    }
}
