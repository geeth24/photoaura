//
//  EditorialMarkdownText.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI

/// Renders the small markdown subset contracts are written in: `# ` title,
/// `## ` headings, `- ` bullets, indented `  - ` sub-bullets, `**bold**`,
/// and plain paragraphs. Same rules as the web's ContractView.
public struct EditorialMarkdownText: View {
    private let blocks: [Block]

    public init(_ markdown: String) {
        self.blocks = Self.parse(markdown)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { i, block in
                view(for: block, first: i == 0)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func view(for block: Block, first: Bool) -> some View {
        switch block {
        case .title(let text):
            VStack(spacing: 0) {
                Text(text)
                    .font(EditorialTypography.serif(size: 26))
                    .tracking(EditorialTypography.Tracking.headingTight)
                    .foregroundStyle(EditorialColors.textPrimary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, EditorialSpacing.large)
                Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1)
            }
            .padding(.bottom, EditorialSpacing.xLarge)
        case .heading(let text):
            Text(text)
                .font(EditorialTypography.serif(size: 20))
                .foregroundStyle(EditorialColors.textPrimary)
                .padding(.top, first ? 0 : EditorialSpacing.xLarge)
                .padding(.bottom, EditorialSpacing.small)
        case .paragraph(let lines):
            Self.inline(lines.joined(separator: "\n"))
                .modifier(BodyText())
                .padding(.vertical, EditorialSpacing.xSmall)
        case .list(let items):
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Rectangle().fill(EditorialColors.brand).frame(width: 10, height: 1)
                            .alignmentGuide(.firstTextBaseline) { d in d[.bottom] + 6 }
                        VStack(alignment: .leading, spacing: 6) {
                            Self.inline(item.text).modifier(BodyText())
                            ForEach(Array(item.children.enumerated()), id: \.offset) { _, child in
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Rectangle().fill(EditorialColors.textFaint).frame(width: 4, height: 4)
                                        .alignmentGuide(.firstTextBaseline) { d in d[.bottom] + 5 }
                                    Self.inline(child).modifier(BodyText())
                                }
                            }
                        }
                    }
                }
            }
            .padding(.vertical, EditorialSpacing.xSmall)
        }
    }

    private struct BodyText: ViewModifier {
        func body(content: Content) -> some View {
            content
                .font(EditorialTypography.sans(size: EditorialTypography.Size.body))
                .foregroundStyle(EditorialColors.textSecondary)
                .lineSpacing(EditorialTypography.LineSpacing.body)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - parsing

    enum Block: Hashable {
        case title(String)
        case heading(String)
        case paragraph([String])
        case list([ListItem])
    }

    struct ListItem: Hashable {
        var text: String
        var children: [String]
    }

    static func parse(_ markdown: String) -> [Block] {
        var blocks: [Block] = []
        var para: [String]?
        var list: [ListItem]?

        func close() {
            if let p = para { blocks.append(.paragraph(p)) }
            if let l = list { blocks.append(.list(l)) }
            para = nil
            list = nil
        }

        let stripped = markdown.replacingOccurrences(of: "<!--[\\s\\S]*?-->", with: "", options: .regularExpression)
        for raw in stripped.components(separatedBy: "\n") {
            let line = raw.replacingOccurrences(of: "\\s+$", with: "", options: .regularExpression)
            if line.trimmingCharacters(in: .whitespaces).isEmpty {
                close()
            } else if line.hasPrefix("# ") {
                close()
                blocks.append(.title(String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)))
            } else if line.hasPrefix("## ") {
                close()
                blocks.append(.heading(String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)))
            } else if line.range(of: "^\\s{2,}- ", options: .regularExpression) != nil, var items = list, !items.isEmpty {
                items[items.count - 1].children.append(
                    line.replacingOccurrences(of: "^\\s+- ", with: "", options: .regularExpression)
                )
                list = items
            } else if line.hasPrefix("- ") {
                if para != nil { close() }
                if list == nil { list = [] }
                list?.append(ListItem(text: String(line.dropFirst(2)), children: []))
            } else {
                if list != nil { close() }
                if para == nil { para = [] }
                para?.append(line.trimmingCharacters(in: .whitespaces))
            }
        }
        close()
        return blocks
    }

    /// `**bold**` runs in the primary text color, everything else as-is.
    static func inline(_ text: String) -> Text {
        var out = AttributedString()
        for (i, part) in text.components(separatedBy: "**").enumerated() where !part.isEmpty {
            var run = AttributedString(part)
            if i % 2 == 1 {
                run.font = EditorialTypography.sans(size: EditorialTypography.Size.body, weight: .medium)
                run.foregroundColor = EditorialColors.textPrimary
            }
            out += run
        }
        return Text(out)
    }
}

#Preview("Markdown") {
    ZStack {
        EditorialColors.background.ignoresSafeArea()
        ScrollView {
            EditorialMarkdownText("""
            # Photography Services Agreement

            ## 1. The event
            This agreement is between **the studio** and the client.

            - Coverage starts at the agreed time
              - Overtime is billed in 30-minute blocks
            - Edited photos within three weeks
            """)
            .padding(24)
        }
    }
    .preferredColorScheme(.dark)
}
