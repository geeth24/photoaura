//
//  EditorialDivider.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialDivider: View {
    private let verticalSpacing: CGFloat

    public init(verticalSpacing: CGFloat = EditorialSpacing.xLarge) {
        self.verticalSpacing = verticalSpacing
    }

    public var body: some View {
        Rectangle()
            .fill(EditorialColors.borderSubtle)
            .frame(height: EditorialMetrics.dividerHeight)
            .padding(.vertical, verticalSpacing)
    }
}

#Preview("Divider") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 0) {
            Text("Above").editorialBody()
            EditorialDivider()
            Text("Below").editorialBody()
        }
        .padding(32)
    }
    .preferredColorScheme(.dark)
}
