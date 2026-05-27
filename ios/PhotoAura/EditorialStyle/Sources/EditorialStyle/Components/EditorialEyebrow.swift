//
//  EditorialEyebrow.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialEyebrow: View {
    private let text: String
    private let color: Color

    public init(_ text: String, color: Color = EditorialColors.brand) {
        self.text = text
        self.color = color
    }

    public var body: some View {
        Text(text)
            .editorialEyebrow(color: color)
    }
}

#Preview("Eyebrow") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(alignment: .leading, spacing: 16) {
            EditorialEyebrow("Your gallery is ready")
            EditorialEyebrow("Sign in")
            EditorialEyebrow("Confirm your email")
        }
        .padding(32)
    }
    .preferredColorScheme(.dark)
}
