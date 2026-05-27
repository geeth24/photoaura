//
//  LoginView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/26/26.
//

import SwiftUI
import EditorialStyle

struct LoginView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthStore.self) private var auth
    @Environment(StudioRegistry.self) private var studios
    @State private var store: LoginStore?
    @State private var pickerPresented = false

    var body: some View {
        Group {
            if let store {
                LoginContent(
                    store: store,
                    onPickStudio: { pickerPresented = true }
                )
            } else {
                Color.clear
            }
        }
        .onAppear {
            if store == nil { store = LoginStore(api: api, auth: auth) }
        }
        .onChange(of: studios.selectedID) { _, _ in
            store = LoginStore(api: api, auth: auth)
        }
        .sheet(isPresented: $pickerPresented) {
            StudioPickerSheet()
        }
    }
}

private struct LoginContent: View {
    @Bindable var store: LoginStore
    @Environment(StudioRegistry.self) private var studios
    let onPickStudio: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                EditorialBrandHeader(logoSize: 56)
                    .padding(.top, 24)

                VStack(alignment: .leading, spacing: EditorialSpacing.xLarge) {
                    EditorialSectionHeader(
                        title: heading,
                        eyebrow: "PhotoAura",
                        subtitle: subtitle
                    )

                    if store.state.sentTo == nil {
                        studioPicker

                        switch store.state.mode {
                        case .magic: magicForm
                        case .password: passwordForm
                        }

                        modeToggle
                    } else {
                        sentConfirmation
                    }
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.xxLarge)
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var heading: String {
        if store.state.sentTo != nil { return "Check your inbox" }
        return store.state.mode == .magic ? "Sign in" : "Sign in with password"
    }

    private var subtitle: String? {
        guard store.state.sentTo == nil else { return nil }
        switch store.state.mode {
        case .magic:
            return "Enter the email your photographer sent your gallery to. We'll send a one-tap sign-in link."
        case .password:
            return "Enter your username and password."
        }
    }

    private var studioPicker: some View {
        Button(action: onPickStudio) {
            HStack(spacing: EditorialSpacing.small) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Studio")
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .tracking(2.5)
                        .textCase(.uppercase)
                        .foregroundStyle(EditorialColors.textMuted)
                    Text(studios.selected.name)
                        .font(EditorialTypography.sans(size: 15, weight: .medium))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(EditorialColors.textMuted)
            }
            .padding(.horizontal, 14)
            .frame(height: 56)
            .background(EditorialColors.surfaceElevated)
            .overlay(
                Rectangle().stroke(EditorialColors.borderDefault, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var magicForm: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            EditorialTextField(
                "you@example.com",
                text: Binding(
                    get: { store.state.email },
                    set: { store.send(.emailChanged($0)) }
                ),
                label: "Email",
                kind: .email,
                footnote: store.state.error,
                isError: store.state.error != nil
            )
            EditorialButton(
                "Email me a sign-in link",
                isLoading: store.state.isSending,
                isDisabled: store.state.email.isEmpty
            ) {
                store.send(.submit)
            }
        }
    }

    private var passwordForm: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            EditorialTextField(
                "username",
                text: Binding(
                    get: { store.state.username },
                    set: { store.send(.usernameChanged($0)) }
                ),
                label: "Username"
            )
            EditorialTextField(
                "•••••••",
                text: Binding(
                    get: { store.state.password },
                    set: { store.send(.passwordChanged($0)) }
                ),
                label: "Password",
                kind: .password,
                footnote: store.state.error,
                isError: store.state.error != nil
            )
            EditorialButton(
                "Sign in",
                isLoading: store.state.isSending,
                isDisabled: store.state.username.isEmpty || store.state.password.isEmpty
            ) {
                store.send(.submit)
            }
        }
    }

    private var modeToggle: some View {
        HStack {
            Spacer()
            Button {
                store.send(.modeChanged(store.state.mode == .magic ? .password : .magic))
            } label: {
                Text(store.state.mode == .magic
                     ? "Sign in with password"
                     : "Use a magic link instead")
                    .font(EditorialTypography.sans(size: 11, weight: .medium))
                    .tracking(1.6)
                    .textCase(.uppercase)
                    .foregroundStyle(EditorialColors.textMuted)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(.top, EditorialSpacing.large)
    }

    private var sentConfirmation: some View {
        EditorialCard {
            VStack(alignment: .leading, spacing: EditorialSpacing.small) {
                Text("Link sent")
                    .editorialHeading()
                Text("If we recognize \(store.state.sentTo ?? ""), a sign-in link is on its way. It expires in 30 minutes.")
                    .editorialSubtitle()
                EditorialButton("Use a different email", style: .secondary) {
                    store.send(.startOver)
                }
                .padding(.top, EditorialSpacing.small)
            }
        }
    }
}

#Preview {
    LoginView()
        .environment(APIClient())
        .environment(AuthStore(api: APIClient()))
        .environment(StudioRegistry())
        .preferredColorScheme(.dark)
}
