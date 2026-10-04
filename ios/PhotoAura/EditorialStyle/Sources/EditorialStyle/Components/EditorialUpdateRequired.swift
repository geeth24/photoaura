//
//  EditorialUpdateRequired.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 10/4/26.
//

import SwiftUI

/// Full-screen stop for a build the server no longer supports. Nothing to
/// dismiss on purpose; the only way forward is the store.
public struct EditorialUpdateRequired: View {
    private let appName: String
    private let message: String?
    private let currentVersion: String?
    private let requiredVersion: String?
    private let onUpdate: () -> Void

    public init(
        appName: String = "PhotoAura",
        message: String? = nil,
        currentVersion: String? = nil,
        requiredVersion: String? = nil,
        onUpdate: @escaping () -> Void
    ) {
        self.appName = appName
        self.message = message
        self.currentVersion = currentVersion
        self.requiredVersion = requiredVersion
        self.onUpdate = onUpdate
    }

    public var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                EditorialAssets.photoAuraLogo
                    .resizable()
                    .scaledToFit()
                    .frame(width: 52, height: 52)

                Spacer(minLength: EditorialSpacing.xxLarge)

                EditorialSectionHeader(title: "Time to update.", eyebrow: "Update required")

                Text(message ?? "This version of \(appName) is no longer supported. Update from the App Store to keep viewing your galleries.")
                    .editorialBody(color: EditorialColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, EditorialSpacing.medium)

                Spacer(minLength: EditorialSpacing.xxLarge)

                EditorialButton("Update", action: onUpdate)

                if let versionLine {
                    Text(versionLine)
                        .editorialHint()
                        .frame(maxWidth: .infinity)
                        .padding(.top, EditorialSpacing.small)
                }
            }
            .padding(.horizontal, EditorialSpacing.screenGutter)
            .padding(.top, EditorialSpacing.xxLarge)
            .padding(.bottom, EditorialSpacing.large)
        }
    }

    private var versionLine: String? {
        switch (currentVersion, requiredVersion) {
        case let (c?, r?): return "You have \(c) · \(r) or newer is needed"
        case let (nil, r?): return "\(r) or newer is needed"
        default: return nil
        }
    }
}

#Preview("Update required") {
    EditorialUpdateRequired(currentVersion: "2.3", requiredVersion: "2.5") {}
}
