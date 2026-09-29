//
//  PhotoViewer.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import Photos
import AVKit
import EditorialStyle

struct PhotoViewer: View {
    let photos: [Photo]
    let startIndex: Int
    // set when opened from an album, so photos can be starred as picks
    var albumSlug: String? = nil
    // bound back to the album view so the reverse hero zoom targets the
    // photo we're currently looking at, not the one we entered on
    @Binding var currentPhotoID: String?

    @Environment(\.dismiss) private var dismiss
    @State private var index: Int
    // chrome visible by default so X button + scrubber + actions are
    // discoverable on entry. Tap photo once to hide for immersive viewing.
    @State private var chromeVisible = true
    @State private var saveState: SaveState = .idle
    @State private var infoPresented = false

    // drag-to-dismiss state — photo follows finger, bg fades; release past
    // threshold pops the nav stack, otherwise springs back
    @State private var dragOffset: CGSize = .zero
    @State private var dragScale: CGFloat = 1.0
    private let dismissThreshold: CGFloat = 140

    init(
        photos: [Photo],
        startIndex: Int,
        currentPhotoID: Binding<String?>,
        albumSlug: String? = nil
    ) {
        self.photos = photos
        self.startIndex = startIndex
        self.albumSlug = albumSlug
        self._currentPhotoID = currentPhotoID
        _index = State(initialValue: startIndex)
        _strip = State(initialValue: ScrollPosition(id: startIndex, anchor: .center))
    }

    // close button via system back chevron — since the viewer is now pushed,
    // we don't need our own X. dismiss() pops the nav stack.

    enum SaveState: Equatable {
        case idle
        case saving
        case saved
        case failed(String)
    }

    enum ShareState: Equatable {
        case idle
        case preparing
        case failed(String)
    }
    @State private var shareState: ShareState = .idle
    @Environment(APIClient.self) private var api
    @State private var favorites: Set<String> = []
    // true once the scroll view owns the gestures, so paging + dismiss stand down
    @State private var isZoomed = false
    @State private var shareItems: [Any] = []
    @State private var shareSheetPresented = false
    @State private var strip = ScrollPosition(idType: Int.self)
    @State private var scrubbing = false

    var body: some View {
        ZStack {
            // bg fades with drag — when you pull down, the grid behind becomes
            // visible instead of dragging a black slab along with the photo
            Color.black
                .opacity(bgOpacity)
                .ignoresSafeArea()

            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { idx, photo in
                    Group {
                        if photo.isVideo {
                            VideoPlayerCell(url: URL(string: photo.image), isCurrent: idx == index)
                        } else {
                            ZoomableImageView(
                                photoID: photo.id,
                                onZoomedChange: { zoomed in
                                    if idx == index { isZoomed = zoomed }
                                }
                            ) {
                                PhotoPage(
                                    thumbnailURL: ImageURLHelper.autoOriented(from: photo.compressedImage, width: 750),
                                    fullURL: photo.isVideo
                                        ? URL(string: photo.image)
                                        : ImageURLHelper.autoOriented(from: photo.image, width: 2048)
                                )
                            }
                            .onTapGesture {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    chromeVisible.toggle()
                                }
                            }
                        }
                    }
                    .tag(idx)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            .scaleEffect(dragScale)
            .offset(dragOffset)
            .simultaneousGesture(dismissDrag)

            if chromeVisible {
                VStack {
                    topBar
                        .padding(.bottom, 28)
                        // soft gradients carry the chrome over bright photos
                        // without a glass card — same trick as Apple Photos
                        .background(
                            LinearGradient(colors: [.black.opacity(0.6), .clear], startPoint: .top, endPoint: .bottom)
                                .ignoresSafeArea(edges: .top)
                        )
                    Spacer()
                    scrubber
                        .padding(.top, 28)
                        .padding(.bottom, EditorialSpacing.small)
                        .background(
                            LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .top, endPoint: .bottom)
                                .ignoresSafeArea(edges: .bottom)
                        )
                }
                .transition(.opacity)
            }
        }
        // scoped to this view, not the window: preferredColorScheme flips the
        // whole scene, so pushing from a light-mode album flashed everything dark
        .environment(\.colorScheme, .dark)
        .statusBarHidden(!chromeVisible)
        .animation(.easeInOut(duration: 0.25), value: chromeVisible)
        // viewer is now a fullScreenCover (not nav push) — no navigation chrome
        // to worry about. parent's tab + nav bars stay visible underneath.
        .onAppear {
            currentPhotoID = photos[index].id
            loadFavorites()
        }
        .onChange(of: index) { _, newIndex in
            currentPhotoID = photos[newIndex].id
            isZoomed = false
        }
        .sheet(isPresented: $infoPresented) {
            PhotoInfoSheet(photo: photos[index])
        }
        .sheet(isPresented: $shareSheetPresented) {
            ActivityShareSheet(items: shareItems)
        }
    }

    // bg opacity tracks drag progress — fully black at rest, transparent at threshold
    private var bgOpacity: Double {
        let progress = min(1, abs(dragOffset.height) / dismissThreshold)
        return 1 - Double(progress) * 0.95
    }

    // vertical drag-to-dismiss — only kicks in for predominantly-vertical drags so
    // TabView's horizontal paging still works for photo navigation
    private var dismissDrag: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { v in
                guard !isZoomed else { return }
                let dy = v.translation.height
                let dx = v.translation.width
                guard abs(dy) > abs(dx) else { return }
                dragOffset = CGSize(width: dx * 0.25, height: dy)
                let progress = min(1, abs(dy) / dismissThreshold)
                dragScale = 1 - progress * 0.25
                if chromeVisible {
                    withAnimation(.easeOut(duration: 0.15)) { chromeVisible = false }
                }
            }
            .onEnded { v in
                guard !isZoomed else { return }
                if abs(v.translation.height) > dismissThreshold {
                    dismiss()
                } else {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                        dragOffset = .zero
                        dragScale = 1
                    }
                }
            }
    }

    // the web gallery's scrubber: the current photo at its real shape, the rest
    // as slivers. Dragging the strip changes the photo under the centre line.
    private static let sliver: CGFloat = 22
    private static let stripHeight: CGFloat = 46
    private static let gap: CGFloat = 2

    private func thumbWidth(_ idx: Int) -> CGFloat {
        guard idx == index else { return Self.sliver }
        let m = photos[idx].fileMetadata
        let aspect = m.height > 0 ? CGFloat(m.width) / CGFloat(m.height) : 1
        return (Self.stripHeight * aspect).clamped(to: Self.sliver...Self.stripHeight * 1.6)
    }

    // which photo sits under the centre line, from the strip's scroll position
    private func photoIndex(atContentX x: CGFloat) -> Int {
        let step = Self.sliver + Self.gap
        let currentStart = CGFloat(index) * step
        let currentEnd = currentStart + thumbWidth(index)
        let i: Int
        if x < currentStart {
            i = Int(x / step)
        } else if x <= currentEnd + Self.gap {
            i = index
        } else {
            i = index + 1 + Int((x - currentEnd - Self.gap) / step)
        }
        return min(max(i, 0), photos.count - 1)
    }

    private var scrubber: some View {
        GeometryReader { geo in
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: Self.gap) {
                    ForEach(photos.indices, id: \.self) { idx in
                        let photo = photos[idx]
                        Color.white.opacity(0.08)
                            .overlay {
                                CachedImage(url: ImageURLHelper.autoOriented(from: photo.compressedImage, width: 750), contentMode: .fill)
                            }
                            .overlay { if photo.isVideo && idx == index { VideoPlayBadge(size: 8) } }
                            .frame(width: thumbWidth(idx), height: Self.stripHeight)
                            .clipped()
                            .opacity(idx == index ? 1 : 0.75)
                            .contentShape(Rectangle())
                            .onTapGesture { withAnimation(.smooth(duration: 0.25)) { index = idx } }
                            .id(idx)
                    }
                }
                .scrollTargetLayout()
            }
            // half a screen of margin so the first and last photos reach the centre
            .contentMargins(.horizontal, geo.size.width / 2, for: .scrollContent)
            .scrollPosition($strip, anchor: .center)
            .onScrollPhaseChange { _, phase in
                scrubbing = phase == .interacting || phase == .decelerating
                if phase == .idle { withAnimation(.smooth(duration: 0.25)) { strip.scrollTo(id: index, anchor: .center) } }
            }
            .onScrollGeometryChange(for: CGFloat.self) { $0.visibleRect.midX } action: { _, midX in
                guard scrubbing else { return }
                let i = photoIndex(atContentX: midX)
                if i != index {
                    index = i
                    UISelectionFeedbackGenerator().selectionChanged()
                }
            }
            .onChange(of: index) { _, i in
                guard !scrubbing else { return }
                withAnimation(.smooth(duration: 0.3)) { strip.scrollTo(id: i, anchor: .center) }
            }
            .task {
                // the lazy strip lays out after the first pass; centre again once it has
                try? await Task.sleep(for: .milliseconds(60))
                strip.scrollTo(id: index, anchor: .center)
            }
            .animation(.smooth(duration: 0.25), value: index)
        }
        .frame(height: Self.stripHeight)
    }

    private static let dayFormat: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .long
        return f
    }()
    private static let timeFormat: DateFormatter = {
        let f = DateFormatter()
        f.timeStyle = .short
        return f
    }()

    // "September 6, 2026" over "6:05 PM · 3 of 15", or just the count
    private var titleLines: (String, String?) {
        let count = "\(index + 1) of \(photos.count)"
        guard let taken = photos[index].fileMetadata.takenAt else { return (count, nil) }
        return (Self.dayFormat.string(from: taken), "\(Self.timeFormat.string(from: taken)) · \(count)")
    }

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

                actionsPill
            }

            let (title, sub) = titleLines
            VStack(spacing: 1) {
                Text(title)
                    .font(EditorialTypography.sans(size: 15, weight: .semibold))
                if let sub {
                    Text(sub)
                        .font(EditorialTypography.sans(size: 11))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            .lineLimit(1)
            .frame(maxWidth: 170)
            .allowsHitTesting(false)
        }
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .padding(.top, EditorialSpacing.xSmall)
        .foregroundStyle(.white)
    }

    private var actionsPill: some View {
        HStack(spacing: 0) {
            if albumSlug != nil, !photos[index].isVideo {
                Button { toggleFavorite() } label: {
                    Image(systemName: isCurrentFavorite ? "heart.fill" : "heart")
                        .foregroundStyle(isCurrentFavorite ? EditorialColors.brand : .white)
                        .contentTransition(.symbolEffect(.replace))
                        .frame(width: 38, height: 38)
                }
                .accessibilityLabel(isCurrentFavorite ? "Remove from picks" : "Add to picks")
            }

            Button { infoPresented = true } label: {
                Image(systemName: "info.circle").frame(width: 38, height: 38)
            }
            .accessibilityLabel("Info")

            Menu {
                Button { Task { await savePhoto(optimized: false) } } label: {
                    Label("Save original", systemImage: "photo")
                }
                if !isVideoPhoto {
                    Button { Task { await savePhoto(optimized: true) } } label: {
                        Label("Save optimized", systemImage: "arrow.down.circle")
                    }
                }
                Button { Task { await prepareShare() } } label: {
                    Label("Share…", systemImage: "square.and.arrow.up")
                }
            } label: {
                Image(systemName: downloadIcon)
                    .contentTransition(.symbolEffect(.replace))
                    .frame(width: 38, height: 38)
            }
            .disabled(saveState == .saving || shareState == .preparing)
            .accessibilityLabel("Save or share")
        }
        .font(.system(size: 15, weight: .semibold))
        .padding(.horizontal, 3)
        .editorialGlass(in: Capsule(), interactive: true)
    }

    // the download button doubles as save/share progress
    private var downloadIcon: String {
        if shareState == .preparing { return "arrow.triangle.2.circlepath" }
        switch saveState {
        case .idle: return "arrow.down.to.line"
        case .saving: return "arrow.triangle.2.circlepath"
        case .saved: return "checkmark"
        case .failed: return "exclamationmark.triangle"
        }
    }

    @MainActor
    private func prepareShare() async {
        guard shareState != .preparing else { return }
        shareState = .preparing
        let url = ImageURLHelper.originalSize(from: photos[index].image)
        do {
            // download original bytes so recipients get the actual high-res
            // photo (AirDrop, Messages, Save-to-Files all attach the file)
            // instead of a CDN link they may not be authorized to open.
            let (data, _) = try await URLSession.shared.data(from: url)
            if let image = UIImage(data: data) {
                shareItems = [image]
            } else {
                shareItems = [url]
            }
            shareState = .idle
            shareSheetPresented = true
        } catch {
            shareItems = [url]
            shareState = .failed(error.localizedDescription)
            shareSheetPresented = true
            try? await Task.sleep(for: .seconds(2))
            if case .failed = shareState { shareState = .idle }
        }
    }

    private var isVideoPhoto: Bool { photos[index].isVideo }

    // MARK: - picks

    private var isCurrentFavorite: Bool {
        favorites.contains(photos[index].fileMetadata.filename)
    }

    private func loadFavorites() {
        guard let albumSlug else { return }
        Task {
            if let names = try? await api.favorites(slug: albumSlug) {
                favorites = Set(names)
            }
        }
    }

    private func toggleFavorite() {
        guard let albumSlug else { return }
        let name = photos[index].fileMetadata.filename
        let wanted = !favorites.contains(name)
        // flip straight away; the network call just confirms it
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            if wanted { favorites.insert(name) } else { favorites.remove(name) }
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            do {
                try await api.setFavorite(slug: albumSlug, filename: name, favorite: wanted)
            } catch {
                withAnimation {
                    if wanted { favorites.remove(name) } else { favorites.insert(name) }
                }
            }
        }
    }

    @MainActor
    private func savePhoto(optimized: Bool) async {
        guard saveState != .saving else { return }
        saveState = .saving
        // Original strips the thumbor prefix for the full-res file; Optimized
        // grabs a ~2560px copy for quick sharing.
        let downloadURL = optimized
            ? ImageURLHelper.optimizedSize(from: photos[index].image)
            : ImageURLHelper.originalSize(from: photos[index].image)
        do {
            try await PhotoSaver.save(url: downloadURL)
            saveState = .saved
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            try? await Task.sleep(for: .seconds(1.5))
            if saveState == .saved { saveState = .idle }
        } catch {
            saveState = .failed(error.localizedDescription)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            try? await Task.sleep(for: .seconds(2))
            if case .failed = saveState { saveState = .idle }
        }
    }
}

// MARK: - Video cell

// Plays the presigned video URL with native AVKit controls. Auto-plays the page
// you're on, pauses the rest so swiping away stops the audio.
private struct VideoPlayerCell: View {
    let url: URL?
    let isCurrent: Bool
    @State private var player: AVPlayer?

    var body: some View {
        Group {
            if let player {
                VideoPlayer(player: player)
            } else {
                Color.black
            }
        }
        .onAppear {
            if player == nil, let url { player = AVPlayer(url: url) }
            if isCurrent { player?.play() }
        }
        .onDisappear { player?.pause() }
        .onChange(of: isCurrent) { _, now in
            now ? player?.play() : player?.pause()
        }
    }
}

// Small play glyph overlaid on video thumbnails in the grids + scrubber.
struct VideoPlayBadge: View {
    var size: CGFloat = 13
    var body: some View {
        Image(systemName: "play.fill")
            .font(.system(size: size, weight: .bold))
            .foregroundStyle(.white)
            .padding(size * 0.6)
            .background(.black.opacity(0.45), in: Circle())
    }
}

// MARK: - Zoomable photo cell

// Renders the already-cached 720px thumbnail instantly, then crossfades to the
// 1920px display copy when it loads. Removes the "tap photo → blank + spinner"
// flash that was happening before.
private struct PhotoPage: View {
    let thumbnailURL: URL?
    let fullURL: URL?
    @State private var fullLoaded = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // the grid already drew this thumbnail, so it comes straight out
                // of the cache on the first frame — no empty frame to flash
                CachedImage(url: thumbnailURL)
                    .frame(width: geo.size.width, height: geo.size.height)

                // full-res crossfades over the top once it arrives
                AsyncImage(url: fullURL, transaction: Transaction(animation: .easeInOut(duration: 0.25))) { phase in
                    if case .success(let img) = phase {
                        img.resizable()
                            .scaledToFit()
                            .onAppear { fullLoaded = true }
                    } else {
                        Color.clear
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
        }
    }
}

// MARK: - Photos library helper

// SwiftUI bridge to UIActivityViewController — ShareLink can take an Image
// but only synchronously. We need to download the original bytes first, so a
// proper system share sheet with the in-memory UIImage is the cleanest path.
struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

enum PhotoSaveError: LocalizedError {
    case denied
    case download
    case write(Error)
    var errorDescription: String? {
        switch self {
        case .denied: return "Photos access denied. Enable it in Settings."
        case .download: return "Couldn't download the photo."
        case .write(let e): return e.localizedDescription
        }
    }
}

enum PhotoSaver {
    static func save(url: URL) async throws {
        // request permission first
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw PhotoSaveError.denied }

        // pull bytes
        let (data, resp) = try await URLSession.shared.data(from: url)
        guard let http = resp as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw PhotoSaveError.download
        }

        try await PHPhotoLibrary.shared().performChanges {
            let req = PHAssetCreationRequest.forAsset()
            req.addResource(with: .photo, data: data, options: nil)
        }
    }
}

private extension Comparable {
    func clamped(to r: ClosedRange<Self>) -> Self { min(max(self, r.lowerBound), r.upperBound) }
}
