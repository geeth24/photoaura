//
//  EditorialAvatar.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialAvatar: View {
    private let initials: String
    private let size: CGFloat
    private let image: Image?

    public init(initials: String, size: CGFloat = 44, image: Image? = nil) {
        self.initials = String(initials.prefix(2)).uppercased()
        self.size = size
        self.image = image
    }

    public init(fullName: String, size: CGFloat = 44, image: Image? = nil) {
        let parts = fullName
            .split(separator: " ")
            .compactMap { $0.first.map(String.init) }
        let init2 = parts.prefix(2).joined()
        self.init(initials: init2.isEmpty ? "?" : init2, size: size, image: image)
    }

    public var body: some View {
        ZStack {
            EditorialColors.brand.opacity(0.1)
            if let image {
                image
                    .resizable()
                    .scaledToFill()
            } else {
                Text(initials)
                    .font(EditorialTypography.sans(size: size * 0.28, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(EditorialColors.brand)
            }
        }
        .frame(width: size, height: size)
        .clipped()
    }
}

#Preview("Avatars") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        HStack(spacing: 12) {
            EditorialAvatar(fullName: "Geeth Gunnampalli", size: 36)
            EditorialAvatar(fullName: "Geeth Gunnampalli", size: 44)
            EditorialAvatar(fullName: "Sam Reactive", size: 56)
            EditorialAvatar(initials: "?", size: 44)
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
