//
//  EditorialTypography.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import CoreText
import CoreGraphics

#if canImport(UIKit)
import UIKit
#endif

public enum EditorialTypography {
    public enum Size {
        public static let eyebrow: CGFloat = 11
        public static let hint: CGFloat = 12
        public static let caption: CGFloat = 13
        public static let subtitle: CGFloat = 14
        public static let body: CGFloat = 15
        public static let bodyLarge: CGFloat = 17
        public static let heading: CGFloat = 28
        public static let display: CGFloat = 40
    }

    public enum Tracking {
        public static let eyebrow: CGFloat = 3.5
        public static let brand: CGFloat = 3.0
        public static let button: CGFloat = 2.4
        public static let headingTight: CGFloat = -0.3
        public static let none: CGFloat = 0
    }

    public enum LineSpacing {
        public static let body: CGFloat = 6
        public static let hint: CGFloat = 4
        public static let heading: CGFloat = 2
    }

    // PostScript names that show up after registration.
    // Outfit is a variable font — use the same family across weights.
    public enum FontName {
        public static let headingSerif: String = "DMSerifDisplay-Regular"
        public static let headingSerifItalic: String = "DMSerifDisplay-Italic"
        public static let bodySans: String = "Outfit"
        public static let wordmark: String = "Blackmud"
    }

    public static func serif(size: CGFloat, italic: Bool = false) -> Font {
        ensureFontsRegistered()
        let name = italic ? FontName.headingSerifItalic : FontName.headingSerif
        return .custom(name, size: size)
    }

    public static func sans(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        ensureFontsRegistered()
        return Font.custom(FontName.bodySans, size: size).weight(weight)
    }

    public static func wordmark(size: CGFloat) -> Font {
        ensureFontsRegistered()
        return .custom(FontName.wordmark, size: size)
    }

    public static func ensureFontsRegistered() {
        _ = fontRegistration
    }

    private static let fontRegistration: Void = registerFonts()

    private static let bundledFontFiles = [
        "DMSerifDisplay-Regular.ttf",
        "DMSerifDisplay-Italic.ttf",
        "Outfit-Variable.ttf",
        "Blackmud.ttf",
    ]

    private static func registerFonts() {
        for fileName in bundledFontFiles {
            let postScriptName = (fileName as NSString).deletingPathExtension
            if isFontAvailable(postScriptName) { continue }

            guard let url = locateFontURL(named: fileName),
                  let provider = CGDataProvider(url: url as CFURL),
                  let font = CGFont(provider) else { continue }

            CTFontManagerRegisterGraphicsFont(font, nil)
        }
    }

    private static func locateFontURL(named fileName: String) -> URL? {
        if let direct = Bundle.module.url(forResource: fileName, withExtension: nil) {
            return direct
        }
        if let nested = Bundle.module.url(forResource: fileName, withExtension: nil, subdirectory: "Fonts") {
            return nested
        }
        guard let resourceURL = Bundle.module.resourceURL,
              let enumerator = FileManager.default.enumerator(at: resourceURL, includingPropertiesForKeys: nil)
        else { return nil }

        for case let url as URL in enumerator where url.lastPathComponent == fileName {
            return url
        }
        return nil
    }

    public static func isFontAvailable(_ name: String) -> Bool {
        #if canImport(UIKit)
        return UIFont(name: name, size: 12) != nil
        #else
        return true
        #endif
    }
}

public extension View {
    func editorialEyebrow(color: Color = EditorialColors.brand) -> some View {
        self
            .font(EditorialTypography.sans(size: EditorialTypography.Size.eyebrow, weight: .semibold))
            .tracking(EditorialTypography.Tracking.eyebrow)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }

    func editorialHeading(color: Color = EditorialColors.textPrimary) -> some View {
        self
            .font(EditorialTypography.serif(size: EditorialTypography.Size.heading))
            .tracking(EditorialTypography.Tracking.headingTight)
            .foregroundStyle(color)
            .lineSpacing(EditorialTypography.LineSpacing.heading)
    }

    func editorialDisplay(color: Color = EditorialColors.textPrimary) -> some View {
        self
            .font(EditorialTypography.serif(size: EditorialTypography.Size.display))
            .tracking(EditorialTypography.Tracking.headingTight)
            .foregroundStyle(color)
    }

    func editorialSubtitle(color: Color = EditorialColors.textSecondary) -> some View {
        self
            .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
            .foregroundStyle(color)
            .lineSpacing(EditorialTypography.LineSpacing.hint)
    }

    func editorialBody(color: Color = EditorialColors.textPrimary) -> some View {
        self
            .font(EditorialTypography.sans(size: EditorialTypography.Size.body))
            .foregroundStyle(color)
            .lineSpacing(EditorialTypography.LineSpacing.body)
    }

    func editorialHint(color: Color = EditorialColors.textMuted) -> some View {
        self
            .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
            .foregroundStyle(color)
            .lineSpacing(EditorialTypography.LineSpacing.hint)
    }

    func editorialBrandMark(color: Color = EditorialColors.brand) -> some View {
        self
            .font(EditorialTypography.sans(size: EditorialTypography.Size.eyebrow, weight: .semibold))
            .tracking(EditorialTypography.Tracking.brand)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }

    func editorialWordmark(size: CGFloat = 32, color: Color = EditorialColors.textPrimary) -> some View {
        self
            .font(EditorialTypography.wordmark(size: size))
            .foregroundStyle(color)
    }
}

#Preview("Type ramp") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(alignment: .leading, spacing: 16) {
            Text("Reactive Shots").editorialWordmark(size: 40)
            Text("Confirm your email").editorialEyebrow()
            Text("Goa Rooftop, Vol. 02").editorialHeading()
            Text("Tap below to sign in to your gallery.").editorialSubtitle()
            Text("Inside you can browse the full shoot.").editorialBody()
            Text("This link expires in 30 minutes.").editorialHint()
            Text("Reactive Shots").editorialBrandMark()
        }
        .padding(32)
    }
    .preferredColorScheme(.dark)
}
