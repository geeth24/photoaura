//
//  EditorialGlass.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI

// Liquid Glass landed in iOS 26. We want one call-site that uses it when
// available and falls back to ultraThinMaterial on iOS 18–25 — which gives
// a very similar frosted look without the dynamic light reactions.
public extension View {
    @ViewBuilder
    func editorialGlass<S: Shape>(in shape: S, interactive: Bool = false, tint: Color? = nil) -> some View {
        if #available(iOS 26.0, *) {
            self.applyingLiquidGlass(in: shape, interactive: interactive, tint: tint)
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }
}

@available(iOS 26.0, *)
private extension View {
    @ViewBuilder
    func applyingLiquidGlass<S: Shape>(in shape: S, interactive: Bool, tint: Color?) -> some View {
        switch (interactive, tint) {
        case (true, let t?):
            self.glassEffect(.regular.tint(t).interactive(), in: shape)
        case (true, nil):
            self.glassEffect(.regular.interactive(), in: shape)
        case (false, let t?):
            self.glassEffect(.regular.tint(t), in: shape)
        case (false, nil):
            self.glassEffect(.regular, in: shape)
        }
    }
}
