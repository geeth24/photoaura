//
//  GalleryActionsSheet.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 8/25/26.
//
//  One place for "I want these photos" — the thing clients actually open the
//  app for. Saving runs inline with live progress so it never looks stuck.
//

import SwiftUI
import EditorialStyle

struct GalleryActionsSheet: View {
    let albumName: String
    let slug: String
    let secret: String?
    let photos: [Photo]

    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss

    @State private var phase: Phase = .idle
    @State private var savedCount = 0
    @State private var failedCount = 0
    @State private var task: Task<Void, Never>?
    @State private var zipURL: URL?
    @State private var preparingZip = false

    enum Phase: Equatable { case idle, saving, finished }

    private var stills: [Photo] { photos.filter { !$0.isVideo } }
    private var shareURL: URL? {
        var s = "https://aura.reactiveshots.com/share/\(slug)"
        if let secret, !secret.isEmpty { s += "?s=\(secret)" }
        return URL(string: s)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: EditorialSpacing.large) {
                    header

                    switch phase {
                    case .idle:
                        optionList
                    case .saving:
                        SaveProgressView(
                            done: savedCount,
                            total: stills.count,
                            onCancel: {
                                task?.cancel()
                                phase = .idle
                            }
                        )
                    case .finished:
                        finishedView
                    }
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.small)
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
            .background(EditorialColors.background)
            .navigationTitle("Get your photos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .onDisappear { task?.cancel() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            EditorialEyebrow("Gallery")
            Text(albumName)
                .font(EditorialTypography.serif(size: 26))
                .foregroundStyle(EditorialColors.textPrimary)
            Text(countLine)
                .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                .foregroundStyle(EditorialColors.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, EditorialSpacing.small)
    }

    private var countLine: String {
        let videos = photos.count - stills.count
        var s = "\(stills.count) photo\(stills.count == 1 ? "" : "s")"
        if videos > 0 { s += " · \(videos) video\(videos == 1 ? "" : "s")" }
        return s
    }

    private var optionList: some View {
        VStack(spacing: EditorialSpacing.small) {
            actionRow(
                icon: "square.and.arrow.down",
                title: "Save all to Photos",
                subtitle: "Straight into your camera roll",
                prominent: true
            ) { startSaveAll() }

            if let shareURL {
                ShareLink(item: shareURL) {
                    rowLabel(
                        icon: "square.and.arrow.up",
                        title: "Share the gallery",
                        subtitle: "Send a link on WhatsApp, Messages, anywhere",
                        prominent: false
                    )
                }
                .buttonStyle(.plain)
            }

            actionRow(
                icon: preparingZip ? "arrow.triangle.2.circlepath" : "doc.zipper",
                title: preparingZip ? "Preparing…" : "Download as a zip",
                subtitle: "Full-size originals, saved to Files",
                prominent: false
            ) { openZip() }
            .disabled(preparingZip)
        }
    }

    private var finishedView: some View {
        VStack(spacing: EditorialSpacing.small) {
            ZStack {
                Circle()
                    .fill(EditorialColors.brand.opacity(0.12))
                    .frame(width: 76, height: 76)
                Image(systemName: "checkmark")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(EditorialColors.brand)
            }
            .transition(.scale.combined(with: .opacity))

            Text(failedCount == 0 ? "All saved" : "Mostly saved")
                .font(EditorialTypography.serif(size: 24))
                .foregroundStyle(EditorialColors.textPrimary)

            Text(failedCount == 0
                 ? "\(savedCount) photo\(savedCount == 1 ? "" : "s") are in your camera roll."
                 : "\(savedCount - failedCount) of \(savedCount) saved. \(failedCount) couldn't be downloaded.")
                .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                .foregroundStyle(EditorialColors.textMuted)
                .multilineTextAlignment(.center)

            Button("Done") { dismiss() }
                .font(EditorialTypography.sans(size: EditorialTypography.Size.body, weight: .semibold))
                .foregroundStyle(EditorialColors.brand)
                .padding(.top, EditorialSpacing.small)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, EditorialSpacing.xxLarge)
    }

    private func actionRow(
        icon: String, title: String, subtitle: String, prominent: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            rowLabel(icon: icon, title: title, subtitle: subtitle, prominent: prominent)
        }
        .buttonStyle(.plain)
    }

    private func rowLabel(icon: String, title: String, subtitle: String, prominent: Bool) -> some View {
        HStack(spacing: EditorialSpacing.medium) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(prominent ? EditorialColors.background : EditorialColors.brand)
                .frame(width: 38, height: 38)
                .background(prominent ? EditorialColors.brand : EditorialColors.brand.opacity(0.12))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.body, weight: .semibold))
                    .foregroundStyle(EditorialColors.textPrimary)
                Text(subtitle)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                    .foregroundStyle(EditorialColors.textMuted)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(EditorialColors.textFaint)
        }
        .padding(EditorialSpacing.medium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
    }

    // MARK: - actions

    private func startSaveAll() {
        guard !stills.isEmpty else { return }
        savedCount = 0
        failedCount = 0
        withAnimation(.easeOut(duration: 0.25)) { phase = .saving }

        task = Task {
            do {
                try await BulkSaver.requestAccess()
            } catch {
                withAnimation { phase = .idle }
                return
            }
            for photo in stills {
                if Task.isCancelled { return }
                let url = ImageURLHelper.originalSize(from: photo.image)
                do {
                    try await BulkSaver.save(url: url, isVideo: false)
                } catch {
                    failedCount += 1
                }
                withAnimation(.easeOut(duration: 0.15)) { savedCount += 1 }
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { phase = .finished }
        }
    }

    private func openZip() {
        guard !preparingZip else { return }
        preparingZip = true
        Task {
            defer { preparingZip = false }
            guard let ticket = try? await api.downloadTicket(slug: slug) else { return }
            let base = api.baseURL.absoluteString.trimmingCharacters(in: ["/"])
            let escaped = ticket.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ticket
            guard let url = URL(string: "\(base)/album/\(slug)/download-all?ticket=\(escaped)") else { return }
            await MainActor.run { zipURL = url }
            await UIApplication.shared.open(url)
        }
    }
}

// MARK: - progress

private struct SaveProgressView: View {
    let done: Int
    let total: Int
    let onCancel: () -> Void

    private var fraction: Double { total == 0 ? 0 : Double(done) / Double(total) }

    var body: some View {
        VStack(spacing: EditorialSpacing.medium) {
            ZStack {
                Circle()
                    .stroke(EditorialColors.borderSubtle, lineWidth: 6)
                Circle()
                    .trim(from: 0, to: fraction)
                    .stroke(EditorialColors.brand, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.25), value: fraction)
                VStack(spacing: 0) {
                    Text("\(Int(fraction * 100))")
                        .font(EditorialTypography.serif(size: 30))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .contentTransition(.numericText())
                    Text("percent")
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .tracking(EditorialTypography.Tracking.eyebrow)
                        .textCase(.uppercase)
                        .foregroundStyle(EditorialColors.textFaint)
                }
            }
            .frame(width: 132, height: 132)
            .padding(.top, EditorialSpacing.large)

            Text("Saving \(done) of \(total)")
                .font(EditorialTypography.sans(size: EditorialTypography.Size.body, weight: .medium))
                .foregroundStyle(EditorialColors.textPrimary)
                .contentTransition(.numericText())

            Text("Keep the app open while these copy across.")
                .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                .foregroundStyle(EditorialColors.textMuted)
                .multilineTextAlignment(.center)

            Button("Cancel", action: onCancel)
                .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle, weight: .medium))
                .foregroundStyle(EditorialColors.textSecondary)
                .padding(.top, EditorialSpacing.xSmall)
        }
        .frame(maxWidth: .infinity)
    }
}
