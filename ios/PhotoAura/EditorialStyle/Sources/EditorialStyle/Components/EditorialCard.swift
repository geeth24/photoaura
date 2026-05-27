//
//  EditorialCard.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialCard<Content: View>: View {
    private let content: Content
    private let padding: EdgeInsets

    public init(
        padding: EdgeInsets = EdgeInsets(
            top: EditorialSpacing.cardPaddingVertical,
            leading: EditorialSpacing.cardPaddingHorizontal,
            bottom: EditorialSpacing.cardPaddingVertical,
            trailing: EditorialSpacing.cardPaddingHorizontal
        ),
        @ViewBuilder content: () -> Content
    ) {
        self.padding = padding
        self.content = content()
    }

    public var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(EditorialColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 0, style: .continuous)
                    .stroke(EditorialColors.borderSubtle, lineWidth: EditorialMetrics.borderWidth)
            )
    }
}

#Preview("Card") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        EditorialCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Your gallery is ready").editorialEyebrow()
                Text("Goa Rooftop, Vol. 02").editorialHeading()
                Text("Hi Geeth — your photos are ready to view and download.").editorialSubtitle()
            }
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
