//
//  EditorialTimeline.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// A vertical activity feed on a hairline rail. The first entry is the
/// latest and gets the filled marker.
public struct EditorialTimeline: View {
    public struct Entry: Hashable, Sendable {
        public let title: String
        public let detail: String?

        public init(_ title: String, detail: String? = nil) {
            self.title = title
            self.detail = detail
        }
    }

    private let entries: [Entry]

    public init(_ entries: [Entry]) {
        self.entries = entries
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            ForEach(Array(entries.enumerated()), id: \.offset) { i, entry in
                HStack(alignment: .top, spacing: EditorialSpacing.small) {
                    Rectangle()
                        .fill(i == 0 ? EditorialColors.brand : EditorialColors.surfaceElevated)
                        .frame(width: 7, height: 7)
                        .overlay(Rectangle().stroke(i == 0 ? EditorialColors.brand : EditorialColors.borderStrong, lineWidth: 1))
                        .padding(.top, 5)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.title)
                            .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                            .foregroundStyle(EditorialColors.textPrimary)
                        if let detail = entry.detail {
                            Text(detail)
                                .font(EditorialTypography.sans(size: 11))
                                .foregroundStyle(EditorialColors.textFaint)
                        }
                    }
                }
            }
        }
        .padding(.leading, 1)
        .background(alignment: .leading) {
            Rectangle().fill(EditorialColors.borderSubtle).frame(width: 1).padding(.leading, 4).padding(.vertical, 6)
        }
    }
}

#Preview("Timeline") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        EditorialTimeline([
            .init("Booking retainer received", detail: "Oct 2, 2026, 4:10 PM"),
            .init("Contract signed", detail: "Oct 1, 2026, 9:12 PM"),
            .init("Contract sent", detail: "Sep 30, 2026, 11:00 AM"),
        ])
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
