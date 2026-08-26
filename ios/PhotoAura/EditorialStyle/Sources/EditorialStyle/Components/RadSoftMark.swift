//
//  RadSoftMark.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 8/25/26.
//
//  The Rad Soft mark, drawn as a vector so it tints with foregroundStyle and
//  stays crisp at any size. Geometry matches the shared rad-soft-logo SVG
//  (viewBox 0 0 870 960) used across the other Rad Soft apps.
//

import SwiftUI

public struct RadSoftMark: Shape {
    public init() {}

    // normalised from the 870x960 viewBox
    private static let points: [CGPoint] = [
        CGPoint(x: 869.688, y: 498.419),
        CGPoint(x: 869.688, y: 246.323),
        CGPoint(x: 434.815, y: 0),
        CGPoint(x: 0, y: 246.323),
        CGPoint(x: 0, y: 713.676),
        CGPoint(x: 205.925, y: 830.329),
        CGPoint(x: 205.925, y: 411.357),
        CGPoint(x: 434.815, y: 274.197),
        CGPoint(x: 438.559, y: 276.469),
        CGPoint(x: 687.092, y: 417.189),
        CGPoint(x: 448.443, y: 560.061),
        CGPoint(x: 283.163, y: 466.431),
        CGPoint(x: 283.163, y: 874.105),
        CGPoint(x: 434.815, y: 960),
        CGPoint(x: 869.688, y: 712.203),
        CGPoint(x: 869.688, y: 591.619),
        CGPoint(x: 667.215, y: 710.312),
        CGPoint(x: 667.215, y: 615.207),
    ]

    public func path(in rect: CGRect) -> Path {
        // fit the artwork inside the rect without distorting it
        let scale = min(rect.width / 870, rect.height / 960)
        let drawn = CGSize(width: 870 * scale, height: 960 * scale)
        let dx = rect.minX + (rect.width - drawn.width) / 2
        let dy = rect.minY + (rect.height - drawn.height) / 2

        var path = Path()
        for (i, p) in Self.points.enumerated() {
            let point = CGPoint(x: dx + p.x * scale, y: dy + p.y * scale)
            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        path.closeSubpath()
        return path
    }
}

/// Sized, tintable Rad Soft logo.
public struct RadSoftLogo: View {
    private let height: CGFloat

    public init(height: CGFloat = 14) {
        self.height = height
    }

    public var body: some View {
        RadSoftMark()
            .frame(width: height * (870.0 / 960.0), height: height)
            .accessibilityLabel("Rad Soft")
    }
}
