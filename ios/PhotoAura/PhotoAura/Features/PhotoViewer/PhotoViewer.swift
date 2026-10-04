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

/// Full-screen photo viewer, shown as a clear cover over the grid. One image
/// flies between the tapped tile and the screen (the web gallery's zoom), and
/// pulling down shrinks the photo under your finger before it flies back.
struct PhotoViewer: View {
    let photos: [Photo]
    let startIndex: Int
    // set when opened from an album, so photos can be starred as picks
    var albumSlug: String? = nil
    // the photo on screen; the grid keeps its tile visible for the flight back
    @Binding var currentPhotoID: String?
    // where a photo's tile sits on screen right now, if it's visible
    var sourceFrame: (String) -> CGRect? = { _ in nil }
    var onClose: () -> Void = {}

    @State private var index: Int
    // chrome visible by default so X button + scrubber + actions are
    // discoverable on entry. Tap photo once to hide for immersive viewing.
    @State private var chromeVisible = true
    @State private var saveState: SaveState = .idle
    @State private var infoPresented = false
    @State private var comparePresented = false

    init(
        photos: [Photo],
        startIndex: Int,
        currentPhotoID: Binding<String?>,
        albumSlug: String? = nil,
        sourceFrame: @escaping (String) -> CGRect? = { _ in nil },
        onClose: @escaping () -> Void = {}
    ) {
        self.photos = photos
        self.startIndex = startIndex
        self.albumSlug = albumSlug
        self._currentPhotoID = currentPhotoID
        self.sourceFrame = sourceFrame
        self.onClose = onClose
        _index = State(initialValue: startIndex)
        _strip = State(initialValue: ScrollPosition(id: startIndex, anchor: .center))
        _page = State(initialValue: startIndex)
        // start on the tile from the very first frame; setting it in onAppear
        // drew the full-size photo for one frame first
        _heroRect = State(initialValue: sourceFrame(photos[startIndex].id))
    }

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
    @State private var shareItems: [Any] = []
    @State private var shareSheetPresented = false
    @State private var strip = ScrollPosition(idType: Int.self)
    @State private var scrubbing = false
    @State private var page: Int?
    // zoomed into a photo, the pager stands down so the photo can pan
    @State private var isZoomed = false

    // the flight between tile and screen: one image, framed by heroRect
    @State private var heroRect: CGRect?
    @State private var heroOpacity: Double = 1
    @State private var backdrop: Double = 0
    @State private var closing = false
    // chrome waits for the flight in to land
    @State private var chromeReady = false
    // pull-down: the photo follows the finger and shrinks, the grid shows through
    @State private var drag: CGSize = .zero
    @State private var screen: CGSize = .zero

    private static let flight = Animation.smooth(duration: 0.38)
    private static let dismissDistance: CGFloat = 110

    var body: some View {
        ZStack {
            Color.black
                .opacity(backdrop * (1 - dragProgress * 0.9))
                .ignoresSafeArea()

            // a plain paging scroll view, not TabView: TabView paging fought the
            // vertical pull-to-close drag
            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(photos.indices, id: \.self) { idx in
                        pageView(idx)
                            .containerRelativeFrame([.horizontal, .vertical])
                            .id(idx)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $page)
            .scrollIndicators(.hidden)
            // zoomed in, the photo pans instead of paging
            .scrollDisabled(isZoomed || drag != .zero)
            .ignoresSafeArea()
            .scaleEffect(dragScale)
            .offset(drag)
            .simultaneousGesture(pullToClose)
            .opacity(heroRect == nil ? 1 : 0)
            .onChange(of: page) { _, p in
                if let p, p != index { index = p }
            }

            if let heroRect {
                CachedImage(url: thumbURL(photos[index]), contentMode: .fill)
                    .frame(width: heroRect.width, height: heroRect.height)
                    .clipped()
                    .position(x: heroRect.midX, y: heroRect.midY)
                    .opacity(heroOpacity)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            if chromeVisible && chromeReady && heroRect == nil && drag == .zero {
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
                    VStack(spacing: EditorialSpacing.small) {
                        if canCompare { compareButton }
                        scrubber
                    }
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
        // full-screen size, insets added back: the pager and the flight both ignore
        // safe areas, and a safe-area-sized screen landed the flight 47pt high
        .onGeometryChange(for: CGSize.self) { g in
            CGSize(
                width: g.size.width + g.safeAreaInsets.leading + g.safeAreaInsets.trailing,
                height: g.size.height + g.safeAreaInsets.top + g.safeAreaInsets.bottom
            )
        } action: { screen = $0 }
        // scoped to this view, not the window: preferredColorScheme flips the
        // whole scene, so opening from a light-mode album flashed everything dark
        .environment(\.colorScheme, .dark)
        .statusBarHidden(!chromeVisible)
        .animation(.easeInOut(duration: 0.25), value: chromeVisible)
        .onAppear {
            currentPhotoID = photos[index].id
            loadFavorites()
            open()
        }
        .onChange(of: index) { _, newIndex in
            currentPhotoID = photos[newIndex].id
            isZoomed = false
            if page != newIndex { page = newIndex }
        }
        .sheet(isPresented: $infoPresented) {
            PhotoInfoSheet(photo: photos[index])
        }
        .sheet(isPresented: $shareSheetPresented) {
            ActivityShareSheet(items: shareItems)
        }
        // its own cover, so the compare view never touches the flight state above
        .fullScreenCover(isPresented: $comparePresented) {
            PhotoCompareView(photo: photos[index])
        }
    }

    // MARK: - flight

    private func thumbURL(_ photo: Photo) -> URL? {
        ImageURLHelper.autoOriented(from: photo.compressedImage, width: 750)
    }

    // where the pager draws a photo: aspect-fit, centred on the whole screen
    private func fitRect(_ photo: Photo) -> CGRect {
        let size = screen == .zero ? UIScreen.main.bounds.size : screen
        let m = photo.fileMetadata
        guard m.width > 0, m.height > 0 else { return CGRect(origin: .zero, size: size) }
        let s = min(size.width / CGFloat(m.width), size.height / CGFloat(m.height))
        let w = CGFloat(m.width) * s, h = CGFloat(m.height) * s
        return CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h)
    }

    private var dragProgress: CGFloat { min(1, max(0, drag.height) / (Self.dismissDistance * 2.4)) }
    private var dragScale: CGFloat { 1 - dragProgress * 0.35 }

    private func open() {
        let fit = fitRect(photos[index])
        guard heroRect != nil else {
            withAnimation(Self.flight) {
                backdrop = 1
                chromeReady = true
            }
            return
        }
        // next runloop so the starting frame is on screen before the flight
        DispatchQueue.main.async {
            withAnimation(Self.flight) {
                heroRect = fit
                backdrop = 1
            } completion: {
                // the pager draws the same image in the same rect, so swapping in one
                // frame is invisible; fading the swap left a black gap between them
                heroRect = nil
                withAnimation(.easeOut(duration: 0.2)) { chromeReady = true }
            }
        }
    }

    /// Flies the photo from where it is now back into its tile, or fades it if
    /// the tile is off screen, then removes the viewer.
    private func close() {
        guard !closing else { return }
        closing = true
        let photo = photos[index]
        // the photo as drawn right now, drag and shrink included
        let fit = fitRect(photo)
        let s = dragScale
        let c = CGPoint(x: (screen.width) / 2, y: (screen.height) / 2)
        let now = CGRect(
            x: c.x + (fit.minX - c.x) * s + drag.width,
            y: c.y + (fit.minY - c.y) * s + drag.height,
            width: fit.width * s,
            height: fit.height * s
        )
        heroRect = now
        // carry the dimmed backdrop over as-is; zeroing the drag alone flashed it back to black
        backdrop *= 1 - dragProgress * 0.9
        drag = .zero
        let target = sourceFrame(photo.id)
        withAnimation(Self.flight) {
            if let target {
                heroRect = target
            } else {
                heroRect = now.insetBy(dx: now.width * 0.2, dy: now.height * 0.2)
                heroOpacity = 0
            }
            backdrop = 0
        } completion: {
            onClose()
        }
    }

    private var pullToClose: some Gesture {
        DragGesture(minimumDistance: 14)
            .onChanged { v in
                guard !isZoomed, !closing, heroRect == nil else { return }
                // only mostly-vertical pulls; sideways swipes page
                guard drag != .zero || abs(v.translation.height) > abs(v.translation.width) * 1.2 else { return }
                drag = CGSize(width: v.translation.width * 0.6, height: max(v.translation.height, -40))
            }
            .onEnded { v in
                guard drag != .zero else { return }
                let flung = v.predictedEndTranslation.height > Self.dismissDistance * 2
                if v.translation.height > Self.dismissDistance || flung {
                    close()
                } else {
                    withAnimation(.smooth(duration: 0.3)) { drag = .zero }
                }
            }
    }

    @ViewBuilder
    private func pageView(_ idx: Int) -> some View {
        let photo = photos[idx]
        Group {
            if photo.isVideo {
                VideoPlayerCell(url: URL(string: photo.image), isCurrent: idx == index)
            } else {
                ZoomableImageView(photoID: photo.id, onZoomedChange: { zoomed in
                    if idx == index { isZoomed = zoomed }
                }) {
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

    // "September 6, 2026" over "6:05 PM · 3 of 15 · v2", or just the count
    private var titleLines: (String, String?) {
        var count = "\(index + 1) of \(photos.count)"
        let meta = photos[index].fileMetadata
        if meta.isRevised { count += " · v\(meta.currentVersion)" }
        guard let taken = meta.takenAt else { return (count, nil) }
        return (Self.dayFormat.string(from: taken), "\(Self.timeFormat.string(from: taken)) · \(count)")
    }

    private var topBar: some View {
        ZStack {
            HStack {
                Button { close() } label: {
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

    private var compareButton: some View {
        Button { comparePresented = true } label: {
            HStack(spacing: 6) {
                Image(systemName: "square.split.2x1")
                    .font(.system(size: 12, weight: .semibold))
                Text("Compare")
                    .font(EditorialTypography.sans(size: 11, weight: .semibold))
                    .tracking(1.6)
                    .textCase(.uppercase)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .frame(height: 34)
        }
        .editorialGlass(in: Capsule(), interactive: true)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .accessibilityLabel("Compare with the earlier version")
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

    private var canCompare: Bool {
        let meta = photos[index].fileMetadata
        return meta.isRevised && meta.id != nil && !isVideoPhoto
    }

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
struct PhotoPage: View {
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
