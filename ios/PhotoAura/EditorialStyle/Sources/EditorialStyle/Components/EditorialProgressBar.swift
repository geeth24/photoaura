//
//  EditorialProgressBar.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialProgressBar: View {
    private let progress: Double
    private let stage: String?
    private let detail: String?

    public init(progress: Double, stage: String? = nil, detail: String? = nil) {
        self.progress = max(0, min(1, progress))
        self.stage = stage
        self.detail = detail
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(EditorialColors.borderSubtle)
                    Rectangle()
                        .fill(EditorialColors.brand)
                        .frame(width: geo.size.width * progress)
                        .animation(.easeOut(duration: 0.3), value: progress)
                }
            }
            .frame(height: 2)

            if stage != nil || detail != nil {
                HStack {
                    if let stage {
                        Text(stage)
                            .font(EditorialTypography.sans(size: 10, weight: .medium))
                            .tracking(2)
                            .textCase(.uppercase)
                            .foregroundStyle(EditorialColors.textMuted)
                    }
                    Spacer()
                    if let detail {
                        Text(detail)
                            .font(EditorialTypography.sans(size: 11))
                            .foregroundStyle(EditorialColors.textHint)
                    }
                }
            }
        }
    }
}

#Preview("Progress bars") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 28) {
            EditorialProgressBar(progress: 0.34, stage: "Uploading", detail: "8 of 24")
            EditorialProgressBar(progress: 0.72, stage: "Detecting faces", detail: "72%")
            EditorialProgressBar(progress: 1.0, stage: "Done", detail: "24 of 24")
            EditorialProgressBar(progress: 0.15)
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
