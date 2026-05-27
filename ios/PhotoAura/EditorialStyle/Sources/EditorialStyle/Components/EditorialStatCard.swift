//
//  EditorialStatCard.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialStatCard: View {
    private let label: String
    private let value: String
    private let footnote: String?
    private let systemImage: String?

    public init(label: String, value: String, footnote: String? = nil, systemImage: String? = nil) {
        self.label = label
        self.value = value
        self.footnote = footnote
        self.systemImage = systemImage
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(label)
                    .font(EditorialTypography.sans(size: 10, weight: .medium))
                    .tracking(3)
                    .textCase(.uppercase)
                    .foregroundStyle(EditorialColors.textMuted)
                Spacer()
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 14))
                        .foregroundStyle(EditorialColors.textHint)
                }
            }
            Spacer(minLength: 24)
            Text(value)
                .font(EditorialTypography.serif(size: 44))
                .foregroundStyle(EditorialColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            if let footnote {
                Text(footnote)
                    .font(EditorialTypography.sans(size: 10, weight: .medium))
                    .tracking(2)
                    .textCase(.uppercase)
                    .foregroundStyle(EditorialColors.brand.opacity(0.75))
                    .padding(.top, 8)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 140, alignment: .topLeading)
        .background(EditorialColors.surfaceElevated)
    }
}

#Preview("Stat cards") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            EditorialStatCard(label: "Albums", value: "24", footnote: "+3 this month", systemImage: "rectangle.stack")
            EditorialStatCard(label: "Photos", value: "1,284", systemImage: "photo")
            EditorialStatCard(label: "Faces", value: "37", footnote: "12 named", systemImage: "person.crop.circle")
            EditorialStatCard(label: "Clients", value: "8", systemImage: "person.2")
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
