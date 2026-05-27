//
//  EditorialNavigationStyle.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public enum EditorialNavigationStyle {
    // Applies DM Serif Display to UINavigationBar's inline + large titles.
    // Call once from your @main App init().
    public static func apply() {
        #if canImport(UIKit)
        EditorialTypography.ensureFontsRegistered()

        let inlineFont = UIFont(name: EditorialTypography.FontName.headingSerif, size: 18)
            ?? UIFont.systemFont(ofSize: 18, weight: .semibold)
        let largeFont = UIFont(name: EditorialTypography.FontName.headingSerif, size: 38)
            ?? UIFont.systemFont(ofSize: 38, weight: .semibold)

        let foreground = UIColor.label

        let appearance = UINavigationBarAppearance()
        appearance.configureWithDefaultBackground()
        appearance.titleTextAttributes = [
            .font: inlineFont,
            .foregroundColor: foreground,
            .kern: -0.3,
        ]
        appearance.largeTitleTextAttributes = [
            .font: largeFont,
            .foregroundColor: foreground,
            .kern: -0.5,
        ]

        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
        UINavigationBar.appearance().compactScrollEdgeAppearance = appearance
        #endif
    }
}
