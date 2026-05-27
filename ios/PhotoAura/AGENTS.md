# PhotoAura iOS — client gallery app

Native iOS 26 app for clients of Reactive Shots. They get a magic-link email,
tap it on their phone, land in the app authenticated, browse their galleries,
filter to photos of themselves, download what they want.

NOT the photographer/admin tool — that's the Next.js dashboard at
`../../client/`. Same backend (`../../server/`), different audience.

## Stack

- SwiftUI, iOS 26.4 minimum (Liquid Glass features rely on it)
- Local SPM: `EditorialStyle` package — design tokens, fonts, primitives
- URLSession + async/await for networking. No third-party deps.

## Architecture — MVI per feature

Every feature folder ships four files:

```
Features/<Feature>/
├── <Feature>State.swift     struct — pure value, the whole UI state
├── <Feature>Intent.swift    enum — every event the UI / network can fire
├── <Feature>Store.swift     @Observable — owns state, handles intents
└── <Feature>View.swift      SwiftUI view — reads state, sends intents
```

Pattern:

```swift
struct LoginState {
    var email = ""
    var sending = false
    var error: String?
}

enum LoginIntent {
    case emailChanged(String)
    case submit
    case sendSucceeded
    case sendFailed(String)
}

@Observable final class LoginStore {
    private(set) var state = LoginState()
    private let api: APIClient
    init(api: APIClient) { self.api = api }

    func send(_ intent: LoginIntent) {
        switch intent {
        case .emailChanged(let v): state.email = v
        case .submit:
            state.sending = true
            Task {
                do {
                    try await api.requestMagicLink(email: state.email)
                    await MainActor.run { send(.sendSucceeded) }
                } catch {
                    await MainActor.run { send(.sendFailed(error.localizedDescription)) }
                }
            }
        case .sendSucceeded:
            state.sending = false
        case .sendFailed(let m):
            state.sending = false
            state.error = m
        }
    }
}
```

Rules:
- State is a struct (value type). Mutations only inside `send(_:)`.
- Intents are exhaustive — every effect the UI can cause OR observe.
- Views never call API directly. Always go through `store.send(...)`.
- Async work fires from within `send`; results loop back as another intent.

## Design system

Always use `EditorialStyle` primitives. Don't reinvent. If a pattern repeats
in two screens, lift it into the package. Don't hardcode colors, spacing, or
fonts in app code — go through `EditorialColors`, `EditorialSpacing`, etc.

Type:
- `.editorialDisplay()` — hero screen titles (DM Serif 40)
- `.editorialHeading()` — card titles (DM Serif 28)
- `.editorialEyebrow()` — tracked uppercase labels
- `.editorialBody()` / `.editorialSubtitle()` / `.editorialHint()` — body text
- `.editorialWordmark()` — Blackmud, for "PhotoAura" brand mark

Colors mirror `../../client/src/app/globals.css` 1:1. When changing tokens,
change them in both places.

## Liquid Glass — iOS 26

Glass lives on the **chrome layer only**: toolbars, tab bar, floating actions.
**NOT** on photo cards, grid backgrounds, content surfaces.

```swift
// Pill glass button
Button { } label: { Image(systemName: "slider") }
    .glassEffect(.regular.tint(EditorialColors.brand).interactive())

// Custom shape
.glassEffect(in: .rect(cornerRadius: 12))

// Wrap multiple glass buttons together
GlassEffectContainer(spacing: 12) {
    HStack { … }
}
```

Tab bar:
```swift
TabView {
    GalleriesView().tabItem { Label("Galleries", systemImage: "photo.stack") }
    SearchView().tabItem { Label("Search", systemImage: "magnifyingglass") }
        .searchRole(.tab)
    ProfileView().tabItem { Label("Profile", systemImage: "person.crop.circle") }
}
.tabBarMinimizeBehavior(.onScrollDown)
```

Don'ts:
- No glass on `EditorialPhotoCard` or any content
- Don't tint every glass element — reserve tint for primary semantic actions
- Don't nest glass-on-glass; use `GlassEffectContainer`
- Don't animate glass visibility — toggle with `.glassEffect(.identity)`

## Folder layout

```
PhotoAura/
├── App/                   @main, root tab view, deep-link routing
├── Core/                  APIClient, AuthStore, KeychainStore, DeepLink
├── Features/
│   ├── Auth/              login + magic-link verify
│   ├── Galleries/         list of albums client has access to
│   ├── Album/             single album grid + face filter
│   ├── PhotoViewer/       full-screen swiper + download
│   └── Profile/           emails + sign out
└── Resources/
    └── Assets.xcassets    AppIcon only
```

## Backend

- Base URL: `https://aura-api.reactiveshots.com/api` (prod)
- Local dev: port-forward `kubectl port-forward svc/photoaura-backend 8000`
- Auth: Bearer JWT in `Authorization` header. Token in Keychain.
- Magic-link verify: opens `aura://verify?token=<short-token>` deep link
- Endpoints we use:
  - `POST /auth/request-link` — `{ email }` → 200
  - `POST /auth/verify-link` — `{ token }` → `{ access_token, user, ... }`
  - `GET /me` → user details
  - `GET /me/albums` → albums client can see
  - `GET /albums/{slug}` → album w/ photos
  - `GET /albums/{slug}/faces` → faces in this album
  - `GET /albums/{slug}/photos?face_id=…` → filtered photos
