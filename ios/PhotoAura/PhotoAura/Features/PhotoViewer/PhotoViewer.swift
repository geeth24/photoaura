//
//  PhotoViewer.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import Photos
import EditorialStyle

struct PhotoViewer: View {
    let photos: [Photo]
    let startIndex: Int
    // bound back to the album view so the reverse hero zoom targets the
    // photo we're currently looking at, not the one we entered on
    @Binding var currentPhotoID: String?

    @Environment(\.dismiss) private var dismiss
    @State private var index: Int
    // chrome visible by default so X button + filmstrip + actions are
    // discoverable on entry. Tap photo once to hide for immersive viewing.
    @State private var chromeVisible = true
    @State private var saveState: SaveState = .idle
    @State private var infoPresented = false

    // drag-to-dismiss state — photo follows finger, bg fades; release past
    // threshold pops the nav stack, otherwise springs back
    @State private var dragOffset: CGSize = .zero
    @State private var dragScale: CGFloat = 1.0
    private let dismissThreshold: CGFloat = 140

    init(photos: [Photo], startIndex: Int, currentPhotoID: Binding<String?>) {
        self.photos = photos
        self.startIndex = startIndex
        self._currentPhotoID = currentPhotoID
        _index = State(initialValue: startIndex)
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
    @State private var shareItems: [Any] = []
    @State private var shareSheetPresented = false

    var body: some View {
        ZStack {
            // bg fades with drag — when you pull down, the grid behind becomes
            // visible instead of dragging a black slab along with the photo
            Color.black
                .opacity(bgOpacity)
                .ignoresSafeArea()

            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { idx, photo in
                    ZoomablePhoto(
                        thumbnailURL: URL(string: photo.compressedImage),
                        fullURL: URL(string: photo.image)
                    )
                    .tag(idx)
                    .onTapGesture {
                        withAnimation(.easeOut(duration: 0.2)) {
                            chromeVisible.toggle()
                        }
                    }
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
                    Spacer()
                    VStack(spacing: 12) {
                        filmstrip
                        bottomBar
                    }
                    // soft gradient gives the bottom chrome enough contrast
                    // without a heavy glass card — same trick as Apple Photos
                    .background(
                        LinearGradient(
                            colors: [.clear, .black.opacity(0.55), .black.opacity(0.85)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .ignoresSafeArea(edges: .bottom)
                    )
                }
                .transition(.opacity.combined(with: .move(edge: .bottom).combined(with: .opacity)))
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(!chromeVisible)
        .animation(.easeInOut(duration: 0.25), value: chromeVisible)
        // viewer is now a fullScreenCover (not nav push) — no navigation chrome
        // to worry about. parent's tab + nav bars stay visible underneath.
        .onAppear { currentPhotoID = photos[index].id }
        .onChange(of: index) { _, newIndex in
            currentPhotoID = photos[newIndex].id
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

    // horizontal scroll of small thumbnails — current one is the brand-tinted
    // square, others stay muted. Tapping or scrolling drives `index`.
    private var filmstrip: some View {
        GeometryReader { geo in
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(photos.enumerated()), id: \.element.id) { idx, photo in
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) { index = idx }
                            } label: {
                                AsyncImage(url: URL(string: photo.compressedImage)) { img in
                                    img.resizable().scaledToFill()
                                } placeholder: {
                                    Color.white.opacity(0.05)
                                }
                                .frame(width: idx == index ? 56 : 40, height: 56)
                                .clipped()
                                .overlay {
                                    if idx == index {
                                        Rectangle().stroke(.white, lineWidth: 2)
                                    }
                                }
                                .opacity(idx == index ? 1 : 0.55)
                            }
                            .buttonStyle(.plain)
                            .id(idx)
                        }
                    }
                    .padding(.horizontal, geo.size.width / 2 - 20) // let edges scroll to centre
                    .padding(.vertical, 8)
                }
                .onChange(of: index) { _, newValue in
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(newValue, anchor: .center)
                    }
                }
                .onAppear {
                    proxy.scrollTo(index, anchor: .center)
                }
            }
        }
        .frame(height: 72)
        // edge-to-edge — sits flat on the photo with the gradient below for
        // contrast, no glass card around the thumbnails
    }

    private var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 36, height: 36)
            }
            .editorialGlass(in: Circle(), interactive: true)

            Spacer()

            Text("\(index + 1) / \(photos.count)")
                .font(EditorialTypography.sans(size: 11, weight: .medium))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(.white.opacity(0.7))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .editorialGlass(in: Capsule())

            Spacer()

            Button { infoPresented = true } label: {
                Image(systemName: "info.circle")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 36, height: 36)
            }
            .editorialGlass(in: Circle(), interactive: true)
        }
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .padding(.top, EditorialSpacing.xSmall)
        .foregroundStyle(.white)
        .sheet(isPresented: $infoPresented) {
            PhotoInfoSheet(photo: photos[index])
        }
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            Menu {
                Button { Task { await savePhoto(optimized: false) } } label: {
                    Label("Original", systemImage: "photo")
                }
                if !isVideoPhoto {
                    Button { Task { await savePhoto(optimized: true) } } label: {
                        Label("Optimized", systemImage: "arrow.down.circle")
                    }
                }
            } label: {
                actionLabel(systemImage: saveIcon, label: saveLabel)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
            }
            .editorialGlass(in: Capsule(), interactive: true)
            .disabled(saveState == .saving || saveState == .saved)

            actionButton(systemImage: shareIcon, label: shareLabel) {
                Task { await prepareShare() }
            }
            .disabled(shareState == .preparing)
        }
        .padding(.horizontal, EditorialSpacing.screenGutter)
        .padding(.bottom, EditorialSpacing.medium)
        .foregroundStyle(.white)
        .sheet(isPresented: $shareSheetPresented) {
            ActivityShareSheet(items: shareItems)
        }
    }

    private var shareIcon: String {
        switch shareState {
        case .idle: return "square.and.arrow.up"
        case .preparing: return "arrow.triangle.2.circlepath"
        case .failed: return "exclamationmark.triangle"
        }
    }

    private var shareLabel: String {
        switch shareState {
        case .idle: return "Share"
        case .preparing: return "Loading"
        case .failed: return "Failed"
        }
    }

    private func actionButton(systemImage: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            actionLabel(systemImage: systemImage, label: label)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
        }
        .editorialGlass(in: Capsule(), interactive: true)
    }

    private func actionLabel(systemImage: String, label: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
            Text(label)
                .font(EditorialTypography.sans(size: 11, weight: .semibold))
                .tracking(1.6)
                .textCase(.uppercase)
        }
    }

    private var saveIcon: String {
        switch saveState {
        case .idle: return "arrow.down.to.line"
        case .saving: return "arrow.triangle.2.circlepath"
        case .saved: return "checkmark"
        case .failed: return "exclamationmark.triangle"
        }
    }

    private var saveLabel: String {
        switch saveState {
        case .idle: return "Save"
        case .saving: return "Saving"
        case .saved: return "Saved"
        case .failed: return "Failed"
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

    private var isVideoPhoto: Bool {
        photos[index].fileMetadata.contentType?.hasPrefix("video/") == true
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

// MARK: - Zoomable photo cell

// Renders the already-cached 720px thumbnail instantly, then crossfades to the
// 1920px display copy when it loads. Removes the "tap photo → blank + spinner"
// flash that was happening before.
private struct ZoomablePhoto: View {
    let thumbnailURL: URL?
    let fullURL: URL?
    @State private var scale: CGFloat = 1
    @GestureState private var pinch: CGFloat = 1
    @State private var fullLoaded = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // base layer — always renders instantly from the URLCache hit
                AsyncImage(url: thumbnailURL) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFit()
                    } else {
                        Color.black
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)

                // top layer — fades in once the higher-res copy is in memory
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
            .scaleEffect(scale * pinch)
            .gesture(
                MagnificationGesture()
                    .updating($pinch) { value, state, _ in state = value }
                    .onEnded { value in
                        scale = max(1, min(scale * value, 4))
                    }
            )
            .onTapGesture(count: 2) {
                withAnimation(.spring(duration: 0.3)) {
                    scale = scale > 1 ? 1 : 2
                }
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
