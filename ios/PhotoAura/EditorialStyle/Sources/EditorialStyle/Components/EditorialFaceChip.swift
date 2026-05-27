//
//  EditorialFaceChip.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialFaceChip<ImageContent: View>: View {
    private let name: String?
    private let count: Int?
    private let isActive: Bool
    private let image: ImageContent
    private let action: () -> Void

    public init(
        name: String? = nil,
        count: Int? = nil,
        isActive: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder image: () -> ImageContent
    ) {
        self.name = name
        self.count = count
        self.isActive = isActive
        self.action = action
        self.image = image()
    }

    public var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                image
                    .frame(width: 72, height: 72)
                    .clipped()
                    .brightness(isActive ? 0.05 : -0.05)
                    .overlay(
                        Rectangle().stroke(
                            isActive ? EditorialColors.brand : EditorialColors.borderSubtle,
                            lineWidth: isActive ? 1.5 : 1
                        )
                    )
                    .shadow(color: isActive ? EditorialColors.brand.opacity(0.3) : .clear, radius: 14)
                Text(name ?? "\(count ?? 0)")
                    .font(EditorialTypography.sans(size: 10, weight: .medium))
                    .tracking(1.5)
                    .textCase(.uppercase)
                    .foregroundStyle(isActive ? EditorialColors.textPrimary : EditorialColors.textMuted)
                    .lineLimit(1)
            }
        }
        .buttonStyle(EditorialPressStyle())
    }
}

#Preview("Face chips") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        HStack(spacing: 14) {
            EditorialFaceChip(name: "Geeth", isActive: true, action: {}) {
                LinearGradient(colors: [.purple, .pink], startPoint: .top, endPoint: .bottom)
            }
            EditorialFaceChip(name: "Sam", action: {}) {
                LinearGradient(colors: [.blue, .cyan], startPoint: .top, endPoint: .bottom)
            }
            EditorialFaceChip(count: 12, action: {}) {
                LinearGradient(colors: [.orange, .red], startPoint: .top, endPoint: .bottom)
            }
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
