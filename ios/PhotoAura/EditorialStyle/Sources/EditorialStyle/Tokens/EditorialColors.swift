//
//  EditorialColors.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// values mirror client/src/app/globals.css (dark default + .light).
// every token has matched light/dark pairs so SwiftUI flips with the
// system color scheme — no hardcoded .preferredColorScheme(.dark)
// anywhere in the app.
public enum EditorialColors {
    // brand
    public static let brand = dynamic(light: 0x0088D1, dark: 0x00A6FB)
    public static let brandLight = dynamic(light: 0x00A6FB, dark: 0x33BBFF)
    public static let brandDark = dynamic(light: 0x006FAB, dark: 0x0088D1)

    // canvas
    public static let background = dynamic(light: 0xF8FBFD, dark: 0x030D14)
    public static let surfaceElevated = dynamic(light: 0xFFFFFF, dark: 0x071E2E)
    public static let surfaceCard = dynamic(light: 0xF0F5F9, dark: 0x0A2A3F)
    public static let surfaceHover = dynamic(light: 0xE4ECF2, dark: 0x0D3350)

    // text — light mode bumped for white-background contrast,
    // dark mode kept aligned with web alpha values
    public static let textPrimary = dynamic(light: 0x0A1A28, dark: 0xEDF6FC)
    public static let textSecondary = dynamicAlpha(light: 0x0A1A28, lightAlpha: 0.68,
                                                   dark: 0xEDF6FC, darkAlpha: 0.55)
    public static let textMuted = dynamicAlpha(light: 0x0A1A28, lightAlpha: 0.52,
                                               dark: 0xEDF6FC, darkAlpha: 0.42)
    public static let textFaint = dynamicAlpha(light: 0x0A1A28, lightAlpha: 0.28,
                                               dark: 0xEDF6FC, darkAlpha: 0.24)

    // borders — light mode needs more weight to be visible on white,
    // dark mode tuned a touch up so inputs read clearly
    public static let borderSubtle = dynamicAlpha(light: 0x0A1A28, lightAlpha: 0.10,
                                                  dark: 0xEDF6FC, darkAlpha: 0.08)
    public static let borderDefault = dynamicAlpha(light: 0x0A1A28, lightAlpha: 0.18,
                                                   dark: 0xEDF6FC, darkAlpha: 0.14)
    public static let borderStrong = dynamicAlpha(light: 0x0A1A28, lightAlpha: 0.28,
                                                  dark: 0xEDF6FC, darkAlpha: 0.22)
    public static let borderAccent = brand.opacity(0.35)

    // press / overlays
    public static let pressOverlay = textPrimary.opacity(0.04)

    // status — same hue in both modes
    public static let success = Color(red: 0.42, green: 0.86, blue: 0.62)
    public static let warning = Color(red: 0.98, green: 0.79, blue: 0.40)
    public static let error = Color(red: 0.97, green: 0.46, blue: 0.46)

    // legacy aliases (kept until everything migrates)
    public static let moonlight = textPrimary
    public static let surface = surfaceElevated
    public static let textHint = textFaint
    public static let borderHairline = borderDefault
}

// MARK: - helpers

private extension EditorialColors {
    static func dynamic(light: UInt32, dark: UInt32) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(hex: dark, alpha: 1)
                : UIColor(hex: light, alpha: 1)
        })
        #else
        return Color(hex: dark)
        #endif
    }

    static func dynamicAlpha(light: UInt32, lightAlpha: CGFloat,
                             dark: UInt32, darkAlpha: CGFloat) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(hex: dark, alpha: darkAlpha)
                : UIColor(hex: light, alpha: lightAlpha)
        })
        #else
        return Color(hex: dark).opacity(darkAlpha)
        #endif
    }
}

private extension Color {
    init(hex: UInt32) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

#if canImport(UIKit)
private extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat) {
        let r = CGFloat((hex >> 16) & 0xFF) / 255
        let g = CGFloat((hex >> 8) & 0xFF) / 255
        let b = CGFloat(hex & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: alpha)
    }
}
#endif
