//
//  StudioPickerSheet.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import EditorialStyle

struct StudioPickerSheet: View {
    @Environment(StudioRegistry.self) private var studios
    @Environment(\.dismiss) private var dismiss
    @State private var customSheetPresented = false

    var body: some View {
        NavigationStack {
            ZStack {
                EditorialColors.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                        EditorialSectionHeader(
                            eyebrow: "Photographer",
                            subtitle: "Pick the studio that shared your gallery."
                        )
                        .padding(.top, EditorialSpacing.medium)

                        VStack(spacing: 0) {
                            ForEach(studios.all) { studio in
                                row(for: studio)
                            }
                        }

                        EditorialButton("Add a custom studio", style: .secondary) {
                            customSheetPresented = true
                        }
                        .padding(.top, EditorialSpacing.medium)
                    }
                    .padding(.horizontal, EditorialSpacing.screenGutter)
                    .padding(.bottom, EditorialSpacing.xxxLarge)
                }
            }
            .navigationTitle("Choose studio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $customSheetPresented) {
                AddCustomStudioSheet()
            }
        }
    }

    private func row(for studio: Studio) -> some View {
        Button {
            studios.select(studio)
            dismiss()
        } label: {
            EditorialListRow(
                title: studio.name,
                subtitle: studio.apiURL.host
            ) {
                Image(systemName: studio.isBuiltIn ? "camera.aperture" : "globe")
                    .foregroundStyle(EditorialColors.textMuted)
                    .frame(width: 36, height: 36)
            } trailing: {
                if studio.id == studios.selectedID {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(EditorialColors.brand)
                }
            }
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing) {
            if !studio.isBuiltIn {
                Button(role: .destructive) {
                    studios.removeCustom(studio)
                } label: {
                    Label("Remove", systemImage: "trash")
                }
            }
        }
    }
}

private struct AddCustomStudioSheet: View {
    @Environment(StudioRegistry.self) private var studios
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var apiURL = ""
    @State private var error: String? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                EditorialColors.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                        EditorialSectionHeader(
                            eyebrow: "Custom studio",
                            subtitle: "Your photographer should have shared a server URL with you."
                        )
                        .padding(.top, EditorialSpacing.medium)

                        VStack(spacing: EditorialSpacing.medium) {
                            EditorialTextField(
                                "e.g. Bright Studio",
                                text: $name,
                                label: "Studio name"
                            )
                            EditorialTextField(
                                "https://aura-api.example.com/api",
                                text: $apiURL,
                                label: "API URL",
                                kind: .search,
                                footnote: error,
                                isError: error != nil
                            )
                            EditorialButton(
                                "Add studio",
                                isDisabled: name.isEmpty || apiURL.isEmpty
                            ) {
                                save()
                            }
                        }
                    }
                    .padding(.horizontal, EditorialSpacing.screenGutter)
                    .padding(.bottom, EditorialSpacing.xxxLarge)
                }
            }
            .navigationTitle("New studio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedURL = apiURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmedURL),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http" else {
            error = "Enter a full URL including https://"
            return
        }
        let studio = studios.addCustom(name: trimmedName, apiURL: url)
        studios.select(studio)
        dismiss()
    }
}
