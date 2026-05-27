//
//  ProfileView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import SwiftUI
import EditorialStyle

struct ProfileView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthStore.self) private var auth
    @State private var store: ProfileStore?
    @State private var confirmSignOut = false
    @State private var confirmDelete = false
    @State private var editingProfile = false

    var body: some View {
        Group {
            if let store, case .signedIn(let user) = auth.status {
                ProfileContent(
                    user: user,
                    store: store,
                    confirmSignOut: $confirmSignOut,
                    confirmDelete: $confirmDelete,
                    editingProfile: $editingProfile
                )
                .sheet(isPresented: $editingProfile) {
                    EditProfileSheet(user: user)
                }
            } else {
                Color.clear
            }
        }
        .onAppear {
            if store == nil {
                store = ProfileStore(api: api, auth: auth)
            }
        }
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(.large)
        // editorial bottom sheets — consistent across devices, no surprise
        // popovers or alert chrome that clashes with the rest of the app
        .sheet(isPresented: $confirmSignOut) {
            EditorialConfirmSheet(
                title: "Sign out?",
                message: "You'll need a new sign-in link to come back.",
                systemImage: "rectangle.portrait.and.arrow.right",
                primaryLabel: "Sign out",
                isDestructive: true
            ) {
                store?.send(.signOut)
            }
        }
        .sheet(isPresented: $confirmDelete) {
            EditorialConfirmSheet(
                title: "Delete your account?",
                message: "Permanently removes your account, access to galleries shared with you, and your linked emails. This can't be undone.",
                systemImage: "exclamationmark.triangle",
                primaryLabel: "Delete my account",
                isDestructive: true
            ) {
                store?.send(.deleteAccount)
            }
        }
        .alert(
            "Couldn't delete account",
            isPresented: Binding(
                get: { store?.state.deleteError != nil },
                set: { newValue in
                    if !newValue { store?.send(.dismissDeleteError) }
                }
            )
        ) {
            Button("OK") { store?.send(.dismissDeleteError) }
        } message: {
            Text(store?.state.deleteError ?? "")
        }
    }
}

private struct ProfileContent: View {
    let user: CurrentUser
    let store: ProfileStore
    @Binding var confirmSignOut: Bool
    @Binding var confirmDelete: Bool
    @Binding var editingProfile: Bool

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.xLarge) {
                    headerCard
                    aboutSection
                    signOutSection
                    dangerSection
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.medium)
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
        }
    }

    private var headerCard: some View {
        HStack(spacing: EditorialSpacing.medium) {
            EditorialAvatar(fullName: user.fullName, size: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text(user.fullName)
                    .font(EditorialTypography.serif(size: 22))
                    .foregroundStyle(EditorialColors.textPrimary)
                    .lineLimit(1)
                Text(user.userEmail)
                    .font(EditorialTypography.sans(size: 13))
                    .foregroundStyle(EditorialColors.textMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let role = user.role {
                    EditorialBadge(role, tone: role.lowercased() == "admin" ? .brand : .neutral)
                        .padding(.top, 4)
                }
            }
            Spacer()
        }
    }

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.small) {
            EditorialSectionHeader(title: "About", eyebrow: "App", style: .section)
                .padding(.bottom, EditorialSpacing.xSmall)
            VStack(spacing: 0) {
                Button {
                    editingProfile = true
                } label: {
                    EditorialListRow(title: "Edit profile", subtitle: editProfileSubtitle) {
                        Image(systemName: "person.text.rectangle")
                            .foregroundStyle(EditorialColors.textMuted)
                            .frame(width: 36, height: 36)
                    } trailing: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(EditorialColors.textMuted)
                    }
                }
                .buttonStyle(.plain)

                if let webURL = URL(string: "https://aura.reactiveshots.com/profile") {
                    Link(destination: webURL) {
                        EditorialListRow(title: "Manage account", subtitle: "Add emails, change settings") {
                            Image(systemName: "person.crop.circle.badge.checkmark")
                                .foregroundStyle(EditorialColors.textMuted)
                                .frame(width: 36, height: 36)
                        } trailing: {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(EditorialColors.textMuted)
                        }
                    }
                    .buttonStyle(.plain)
                }
                if let supportURL = URL(string: "mailto:hello@reactiveshots.com") {
                    Link(destination: supportURL) {
                        EditorialListRow(title: "Need help?", subtitle: "hello@reactiveshots.com") {
                            Image(systemName: "envelope")
                                .foregroundStyle(EditorialColors.textMuted)
                                .frame(width: 36, height: 36)
                        } trailing: {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(EditorialColors.textMuted)
                        }
                    }
                    .buttonStyle(.plain)
                }
                EditorialListRow(title: "Version") {
                    Image(systemName: "iphone")
                        .foregroundStyle(EditorialColors.textMuted)
                        .frame(width: 36, height: 36)
                } trailing: {
                    Text(appVersion)
                        .font(EditorialTypography.sans(size: 13))
                        .foregroundStyle(EditorialColors.textMuted)
                }
            }
        }
    }

    private var editProfileSubtitle: String {
        if let u = user.userName, !u.isEmpty { return "@\(u)" }
        return "Set a username"
    }

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return b.isEmpty ? v : "\(v) (\(b))"
    }

    private var signOutSection: some View {
        EditorialButton("Sign out", style: .secondary) {
            confirmSignOut = true
        }
        .padding(.top, EditorialSpacing.medium)
    }

    // Apple Guideline 5.1.1(v) — account deletion must be reachable from within the app
    private var dangerSection: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.small) {
            EditorialSectionHeader(title: "Danger zone", eyebrow: "Account", style: .section)
                .padding(.bottom, EditorialSpacing.xSmall)

            Button {
                confirmDelete = true
            } label: {
                HStack(spacing: EditorialSpacing.xSmall) {
                    if store.state.isDeletingAccount {
                        ProgressView()
                            .controlSize(.small)
                            .tint(EditorialColors.error)
                    }
                    Text(store.state.isDeletingAccount ? "Deleting…" : "Delete my account")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(2.4)
                        .textCase(.uppercase)
                        .foregroundStyle(EditorialColors.error)
                }
                .padding(.vertical, 14)
                .padding(.horizontal, 28)
                .frame(maxWidth: .infinity)
                .overlay(Rectangle().stroke(EditorialColors.error.opacity(0.5), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(store.state.isDeletingAccount)

            Text("Permanently removes your account, gallery access, and linked emails. This can't be undone.")
                .editorialHint()
                .padding(.top, EditorialSpacing.xSmall)
        }
        .padding(.top, EditorialSpacing.xLarge)
    }
}
