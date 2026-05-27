//
//  EditorialSkeleton.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialSkeleton: View {
    private let height: CGFloat?
    private let aspect: CGFloat?

    public init(height: CGFloat? = nil, aspect: CGFloat? = nil) {
        self.height = height
        self.aspect = aspect
    }

    public var body: some View {
        Rectangle()
            .fill(EditorialColors.surfaceElevated)
            .modifier(PulseModifier())
            .applying(height: height, aspect: aspect)
    }
}

private extension View {
    @ViewBuilder func applying(height: CGFloat?, aspect: CGFloat?) -> some View {
        if let aspect {
            self.aspectRatio(aspect, contentMode: .fit)
        } else if let height {
            self.frame(height: height)
        } else {
            self.frame(height: 16)
        }
    }
}

private struct PulseModifier: ViewModifier {
    @State private var pulse = false
    func body(content: Content) -> some View {
        content
            .opacity(pulse ? 0.6 : 1)
            .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: pulse)
            .onAppear { pulse = true }
    }
}

#Preview("Skeleton") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 12) {
            EditorialSkeleton(height: 28)
            EditorialSkeleton(height: 16)
            EditorialSkeleton(aspect: 4/3)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(0..<4) { _ in EditorialSkeleton(aspect: 1) }
            }
        }
        .padding(20)
    }
    .preferredColorScheme(.dark)
}
