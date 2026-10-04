//
//  EditorialPhotoTag.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import SwiftUI

public enum EditorialPhotoTagTone {
    case subtle  // quiet marker, e.g. a version number on a grid tile
    case accent  // something new waiting, e.g. on a gallery cover
}

/// A small solid label that sits on top of a photo. Solid fill rather than an
/// outline like EditorialBadge, since it has to read over any image.
public struct EditorialPhotoTag: View {
    private let text: String
    private let tone: EditorialPhotoTagTone
    private let icon: String?
    private let compact: Bool

    public init(_ text: String, tone: EditorialPhotoTagTone = .subtle, icon: String? = nil, compact: Bool = false) {
        self.text = text
        self.tone = tone
        self.icon = icon
        self.compact = compact
    }

    public var body: some View {
        HStack(spacing: 4) {
            if let icon {
                Image(systemName: icon).font(.system(size: compact ? 7 : 9, weight: .bold))
            }
            Text(text)
                .font(EditorialTypography.sans(size: compact ? 9 : 10, weight: .semibold))
                .tracking(compact ? 0.8 : 1.6)
                .textCase(.uppercase)
                .lineLimit(1)
        }
        .fixedSize()
        .foregroundStyle(tone == .accent ? EditorialColors.background : .white)
        .padding(.horizontal, compact ? 5 : 8)
        .padding(.vertical, compact ? 2.5 : 5)
        .background(tone == .accent ? EditorialColors.brand : Color.black.opacity(0.55))
        .overlay(
            Rectangle().stroke(.white.opacity(tone == .accent ? 0 : 0.18), lineWidth: 0.5)
        )
    }
}

#Preview("Photo tags") {
    ZStack {
        LinearGradient(colors: [.orange, .pink, .white], startPoint: .top, endPoint: .bottom)
            .ignoresSafeArea()
        VStack(spacing: 16) {
            EditorialPhotoTag("v2", compact: true)
            EditorialPhotoTag("v3")
            EditorialPhotoTag("Revision 2 ready", tone: .accent, icon: "sparkles")
        }
    }
}
