//
//  EditorialTextField.swift
//  EditorialStyle
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI

public struct EditorialTextField: View {
    public enum FieldKind {
        case text
        case email
        case password
        case search
    }

    private let label: String?
    private let placeholder: String
    @Binding private var text: String
    private let kind: FieldKind
    private let footnote: String?
    private let isError: Bool

    public init(
        _ placeholder: String,
        text: Binding<String>,
        label: String? = nil,
        kind: FieldKind = .text,
        footnote: String? = nil,
        isError: Bool = false
    ) {
        self.placeholder = placeholder
        self._text = text
        self.label = label
        self.kind = kind
        self.footnote = footnote
        self.isError = isError
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.xSmall) {
            if let label {
                Text(label)
                    .font(EditorialTypography.sans(size: 10, weight: .medium))
                    .tracking(2.5)
                    .textCase(.uppercase)
                    .foregroundStyle(EditorialColors.textMuted)
            }

            field
                .font(EditorialTypography.sans(size: 15))
                .foregroundStyle(EditorialColors.textPrimary)
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(EditorialColors.surfaceElevated)
                .overlay(
                    Rectangle()
                        .stroke(
                            isError ? EditorialColors.error : EditorialColors.borderHairline,
                            lineWidth: EditorialMetrics.borderWidth
                        )
                )

            if let footnote {
                Text(footnote)
                    .editorialHint(color: isError ? EditorialColors.error : EditorialColors.textHint)
            }
        }
    }

    @ViewBuilder private var field: some View {
        switch kind {
        case .text, .email, .search:
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(kind == .email || kind == .search ? .never : .sentences)
                .autocorrectionDisabled(kind == .email || kind == .search)
                .keyboardType(kind == .email ? .emailAddress : .default)
        case .password:
            SecureField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
        }
    }
}

#Preview("Text fields") {
    @Previewable @State var email = ""
    @Previewable @State var password = ""
    @Previewable @State var name = "Geeth Gunnampalli"
    return ZStack {
        EditorialColors.background.ignoresSafeArea()
        VStack(spacing: 20) {
            EditorialTextField("you@example.com", text: $email, label: "Email", kind: .email)
            EditorialTextField("•••••••", text: $password, label: "Password", kind: .password)
            EditorialTextField("Full name", text: $name, label: "Name")
            EditorialTextField("", text: .constant("not-an-email"), label: "Email", kind: .email, footnote: "That doesn't look like an email.", isError: true)
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
