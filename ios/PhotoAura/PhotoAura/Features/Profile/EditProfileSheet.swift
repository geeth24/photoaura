//
//  EditProfileSheet.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import EditorialStyle

struct EditProfileSheet: View {
    let user: CurrentUser

    @Environment(APIClient.self) private var api
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var fullName: String
    @State private var userName: String
    @State private var isSaving = false
    @State private var error: String? = nil

    init(user: CurrentUser) {
        self.user = user
        _fullName = State(initialValue: user.fullName)
        _userName = State(initialValue: user.userName ?? "")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                EditorialColors.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: EditorialSpacing.xLarge) {
                        EditorialSectionHeader(
                            title: "Edit profile",
                            eyebrow: "Account",
                            subtitle: "Username is what you'll type at the password sign-in screen. Your name shows on shared galleries."
                        )
                        .padding(.top, EditorialSpacing.medium)

                        VStack(spacing: EditorialSpacing.medium) {
                            EditorialTextField(
                                "Your full name",
                                text: $fullName,
                                label: "Name"
                            )
                            EditorialTextField(
                                "lowercase, no spaces",
                                text: $userName,
                                label: "Username",
                                kind: .text,
                                footnote: error ?? "3–30 chars · letters, numbers, _ or -",
                                isError: error != nil
                            )
                        }

                        EditorialButton(
                            "Save changes",
                            isLoading: isSaving,
                            isDisabled: !hasChanges
                        ) {
                            Task { await save() }
                        }
                    }
                    .padding(.horizontal, EditorialSpacing.screenGutter)
                    .padding(.bottom, EditorialSpacing.xxxLarge)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var hasChanges: Bool {
        let cleanName = fullName.trimmingCharacters(in: .whitespaces)
        let cleanUser = userName.trimmingCharacters(in: .whitespaces).lowercased()
        guard !cleanName.isEmpty, !cleanUser.isEmpty else { return false }
        return cleanName != user.fullName || cleanUser != (user.userName ?? "")
    }

    @MainActor
    private func save() async {
        let cleanName = fullName.trimmingCharacters(in: .whitespaces)
        let cleanUser = userName.trimmingCharacters(in: .whitespaces).lowercased()
        isSaving = true
        error = nil
        do {
            let updated = try await api.updateMe(
                userName: cleanUser != (user.userName ?? "") ? cleanUser : nil,
                fullName: cleanName != user.fullName ? cleanName : nil
            )
            auth.updateCurrentUser(updated)
            dismiss()
        } catch {
            self.error = error.localizedDescription
            self.isSaving = false
        }
    }
}
