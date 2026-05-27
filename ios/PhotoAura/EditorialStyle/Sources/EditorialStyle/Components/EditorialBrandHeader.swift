//
//  EditorialBrandHeader.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialBrandHeader<Logo: View>: View {
    private let logo: Logo
    private let label: String
    private let logoSize: CGFloat

    public init(
        label: String = "PhotoAura",
        logoSize: CGFloat = 44,
        @ViewBuilder logo: () -> Logo
    ) {
        self.label = label
        self.logoSize = logoSize
        self.logo = logo()
    }

    public var body: some View {
        VStack(spacing: EditorialSpacing.small) {
            logo
                .frame(width: logoSize, height: logoSize)
            Text(label)
                .editorialBrandMark()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, EditorialSpacing.xLarge)
    }
}

public extension EditorialBrandHeader where Logo == AnyView {
    init(
        label: String = "PhotoAura",
        logoSize: CGFloat = 44,
        systemImage: String
    ) {
        self.init(label: label, logoSize: logoSize) {
            AnyView(
                Image(systemName: systemImage)
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(EditorialColors.brand)
            )
        }
    }

    init(
        label: String = "PhotoAura",
        logoSize: CGFloat = 44
    ) {
        self.init(label: label, logoSize: logoSize) {
            AnyView(
                EditorialAssets.photoAuraLogo
                    .resizable()
                    .scaledToFit()
            )
        }
    }
}

#Preview("Brand header — PhotoAura logo") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 40) {
            EditorialBrandHeader()
            EditorialBrandHeader(logoSize: 72)
            EditorialBrandHeader(label: "Reactive Shots", systemImage: "camera.aperture")
        }
    }
    .preferredColorScheme(.dark)
}
