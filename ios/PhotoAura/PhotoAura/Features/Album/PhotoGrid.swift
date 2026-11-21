//
//  PhotoGrid.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 9/29/26.
//

import SwiftUI
import EditorialStyle

/// Where each visible tile sits on screen, for the viewer's flight in and out.
/// A plain class on purpose: tiles write to it while scrolling, and that must
/// not re-render the grid.
final class TileFrames {
    var rects: [String: CGRect] = [:]
}

/// A run of tiles, optionally under a pinned header line.
struct PhotoGridSection: Identifiable {
    let id: String
    var header: Text? = nil
    let photos: [Photo]
}

/// Square, edge-to-edge photo grid, same as the web gallery. Pinch to step
/// between 5, 3 and 2 columns; the choice sticks across albums.
struct PhotoGrid: View {
    let sections: [PhotoGridSection]
    let frames: TileFrames
    let onOpen: (PhotoTarget) -> Void

    init(photos: [Photo], frames: TileFrames, onOpen: @escaping (PhotoTarget) -> Void) {
        self.init(sections: [PhotoGridSection(id: "all", photos: photos)], frames: frames, onOpen: onOpen)
    }

    init(sections: [PhotoGridSection], frames: TileFrames, onOpen: @escaping (PhotoTarget) -> Void) {
        self.sections = sections
        self.frames = frames
        self.onOpen = onOpen
    }

    // densest first; the middle step is the default
    static var steps: [Int] { [5, 3, 2] }
    @AppStorage("gridDensity") private var step = 1
    // a pinch lifts two fingers off a tile; that isn't a tap
    @State private var pinching = false
    @State private var pinchEnded = Date.distantPast

    var body: some View {
        LazyVGrid(columns: Self.columns(for: step), spacing: 2, pinnedViews: [.sectionHeaders]) {
            ForEach(indexedSections, id: \.section.id) { entry in
                Section {
                    ForEach(Array(entry.section.photos.enumerated()), id: \.element.id) { idx, photo in
                        tile(photo, index: entry.start + idx)
                    }
                } header: {
                    if let header = entry.section.header { MomentHeader(text: header) }
                }
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

    // each section's first position in the flat list the viewer pages through
    private var indexedSections: [(section: PhotoGridSection, start: Int)] {
        var start = 0
        return sections.map { section in
            defer { start += section.photos.count }
            return (section, start)
        }
    }

    private func tile(_ photo: Photo, index: Int) -> some View {
        PhotoTile(photo: photo)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frames.rects[photo.id] = $0 }
            .onTapGesture {
                guard !pinching, Date.now.timeIntervalSince(pinchEnded) > 0.3 else { return }
                onOpen(PhotoTarget(index: index, sourceID: photo.id))
            }
            .accessibilityAddTraits(.isButton)
    }

    static func columns(for step: Int) -> [GridItem] {
        let n = steps[min(max(step, 0), steps.count - 1)]
        return Array(repeating: GridItem(.flexible(), spacing: 2), count: n)
    }
}

/// Pinned line above a moment's tiles.
private struct MomentHeader: View {
    let text: Text

    var body: some View {
        text
            .font(EditorialTypography.sans(size: 12, weight: .medium))
            .lineLimit(1)
            .padding(.horizontal, EditorialSpacing.screenGutter)
            .padding(.vertical, EditorialSpacing.small)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(EditorialColors.background)
            .accessibilityAddTraits(.isHeader)
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
            .overlay(alignment: .topTrailing) {
                if photo.fileMetadata.isRevised {
                    EditorialPhotoTag("v\(photo.fileMetadata.currentVersion)", compact: true)
                        .padding(4)
                        .accessibilityLabel("Version \(photo.fileMetadata.currentVersion)")
                }
            }
            .clipped()
            .contentShape(Rectangle())
    }
}

extension Transaction {
    /// No animation at all, including the cover's slide-up; the viewer runs its own flight.
    static var instant: Transaction {
        var t = Transaction(animation: nil)
        t.disablesAnimations = true
        return t
    }
}
