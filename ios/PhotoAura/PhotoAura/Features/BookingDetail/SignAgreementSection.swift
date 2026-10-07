//
//  SignAgreementSection.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// Consent, typed name, how it'll sit on the signature line, and the Sign button.
struct SignAgreementSection: View {
    let store: BookingDetailStore
    @FocusState private var nameFocused: Bool

    var body: some View {
        EditorialPanel("Signature", systemImage: "signature") {
            VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                // the consent wording points at the name "below", so it sits above the field
                EditorialCheckbox(
                    BookingFormat.consentText,
                    isOn: Binding(get: { store.state.consent }, set: { store.send(.consentChanged($0)) })
                )

                EditorialTextField(
                    "Your full name",
                    text: Binding(get: { store.state.signName }, set: { store.send(.nameChanged($0)) }),
                    label: "Type your full name",
                    kind: .name
                )
                .focused($nameFocused)
                .submitLabel(.done)

                VStack(alignment: .leading, spacing: 6) {
                    Text(typedName.isEmpty ? "Your name" : typedName)
                        .font(EditorialTypography.serif(size: 32, italic: true))
                        .foregroundStyle(typedName.isEmpty ? EditorialColors.textFaint : EditorialColors.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .padding(.bottom, 6)
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(EditorialColors.borderStrong).frame(height: 1)
                        }
                    Text("Client signature · \(Date.now.formatted(.dateTime.month(.wide).day().year()))")
                        .editorialHint(color: EditorialColors.textFaint)
                }

                Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1)

                Text("We keep your name, the time, and your IP address with the signed copy. You'll get the PDF by email.")
                    .editorialHint()

                EditorialButton(
                    store.state.signing ? "Signing…" : "Sign agreement",
                    isLoading: store.state.signing,
                    isDisabled: !store.state.canSign
                ) {
                    nameFocused = false
                    store.send(.sign)
                }
            }
        }
    }

    private var typedName: String {
        store.state.signName.trimmingCharacters(in: .whitespaces)
    }
}
