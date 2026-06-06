//
//  PhotoInfoSheet.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 6/6/26.
//

import SwiftUI
import EditorialStyle

// Filename + dimensions/size + parsed EXIF (camera, lens, ISO, aperture,
// shutter, focal length, taken) for the photo currently in the viewer.
struct PhotoInfoSheet: View {
    let photo: Photo
    @Environment(\.dismiss) private var dismiss

    private var meta: PhotoMetadata { photo.fileMetadata }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                    Text(meta.filename)
                        .font(EditorialTypography.serif(size: EditorialTypography.Size.heading))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    section("Details", rows: detailRows)
                    if !cameraRows.isEmpty {
                        section("Camera", rows: cameraRows)
                    }
                }
                .padding(EditorialSpacing.screenGutter)
            }
            .background(EditorialColors.background.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .tint(EditorialColors.textMuted)
                }
            }
            .navigationTitle("Info")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func section(_ title: String, rows: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(EditorialTypography.sans(size: EditorialTypography.Size.eyebrow, weight: .medium))
                .tracking(EditorialTypography.Tracking.eyebrow)
                .textCase(.uppercase)
                .foregroundStyle(EditorialColors.textMuted)
                .padding(.bottom, EditorialSpacing.small)

            ForEach(rows, id: \.0) { label, value in
                HStack(alignment: .firstTextBaseline) {
                    Text(label)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                        .foregroundStyle(EditorialColors.textMuted)
                    Spacer(minLength: 16)
                    Text(value)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.caption, weight: .medium))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .multilineTextAlignment(.trailing)
                }
                .padding(.vertical, 8)
                Divider().overlay(EditorialColors.borderSubtle)
            }
        }
    }

    // MARK: - Rows

    private var detailRows: [(String, String)] {
        var r: [(String, String)] = []
        if meta.width > 0, meta.height > 0 { r.append(("Dimensions", "\(meta.width) × \(meta.height)")) }
        if let s = meta.size, let f = Self.formatBytes(s) { r.append(("Size", f)) }
        if let t = meta.contentType, !t.isEmpty { r.append(("Type", t)) }
        if let d = meta.uploadDate, let f = Self.formatDate(d) { r.append(("Uploaded", f)) }
        return r
    }

    private var cameraRows: [(String, String)] {
        guard let raw = meta.exifData,
              let data = raw.data(using: .utf8),
              let e = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else { return [] }

        var r: [(String, String)] = []
        let make = (e["Make"] as? String ?? "").trimmingCharacters(in: .whitespaces)
        let model = (e["Model"] as? String ?? "").trimmingCharacters(in: .whitespaces)
        let camera = model.hasPrefix(make) ? model : [make, model].filter { !$0.isEmpty }.joined(separator: " ")
        if !camera.isEmpty { r.append(("Camera", camera)) }
        if let lens = e["LensModel"] as? String, !lens.isEmpty { r.append(("Lens", lens)) }
        if let iso = Self.num(e["ISOSpeedRatings"] ?? e["PhotographicSensitivity"]) {
            r.append(("ISO", "ISO \(Int(iso))"))
        }
        if let f = Self.num(e["FNumber"] ?? e["ApertureValue"]) {
            r.append(("Aperture", "ƒ/" + Self.trimZero(f)))
        }
        if let exp = Self.num(e["ExposureTime"]) {
            r.append(("Shutter", exp >= 1 ? "\(Self.trimZero(exp))s" : "1/\(Int((1 / exp).rounded()))s"))
        }
        if let fl = Self.num(e["FocalLength"]) { r.append(("Focal length", "\(Int(fl.rounded()))mm")) }
        if let taken = Self.formatDate((e["DateTimeOriginal"] as? String) ?? (e["DateTime"] as? String) ?? "") {
            r.append(("Taken", taken))
        }
        return r
    }

    // MARK: - Formatting

    static func num(_ v: Any?) -> Double? {
        if let n = v as? NSNumber { return n.doubleValue }
        if let s = v as? String {
            if let d = Double(s) { return d }
            let p = s.split(separator: "/")
            if p.count == 2, let a = Double(p[0]), let b = Double(p[1]), b != 0 { return a / b }
        }
        if let arr = v as? [Any], let first = arr.first { return num(first) }
        return nil
    }

    static func trimZero(_ d: Double) -> String {
        let s = String(format: "%.1f", d)
        return s.hasSuffix(".0") ? String(s.dropLast(2)) : s
    }

    static func formatBytes(_ n: Int) -> String? {
        guard n > 0 else { return nil }
        let mb = Double(n) / 1_048_576
        return mb >= 1 ? String(format: "%.1f MB", mb) : "\(n / 1024) KB"
    }

    static func formatDate(_ s: String) -> String? {
        guard !s.isEmpty else { return nil }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short

        // EXIF "YYYY:MM:DD HH:MM:SS"
        let exifFmt = DateFormatter()
        exifFmt.dateFormat = "yyyy:MM:dd HH:mm:ss"
        if let d = exifFmt.date(from: s) { return out.string(from: d) }

        // ISO upload_date
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: s) { return out.string(from: d) }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: s) { return out.string(from: d) }

        // plain "yyyy-MM-dd'T'HH:mm:ss" (no tz)
        let plain = DateFormatter()
        plain.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        if let d = plain.date(from: s) { return out.string(from: d) }
        return nil
    }
}
