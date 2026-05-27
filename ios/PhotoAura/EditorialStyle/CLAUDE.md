# EditorialStyle

SwiftUI design system package for PhotoAura (Reactive Shots). Dark editorial aesthetic
shared with the React Email templates and the reactiveshots.com marketing site.

## Package Structure

```
EditorialStyle/
├── Sources/EditorialStyle/
│   ├── Tokens/
│   │   ├── EditorialColors.swift     — semantic color mappings (brand, text, surface, border)
│   │   ├── EditorialSpacing.swift    — spacing scale (xs=8 … xl=24, gutters)
│   │   ├── EditorialRadius.swift     — corner radius tokens (sm=8 … full=999)
│   │   └── EditorialMetrics.swift    — borders, opacities, shared numbers
│   ├── Typography/
│   │   └── EditorialTypography.swift — font sizes / weights + view modifiers
│   │                                   (.editorialEyebrow(), .editorialHeading(),
│   │                                    .editorialSubtitle(), .editorialBody(),
│   │                                    .editorialHint())
│   ├── Components/
│   │   ├── EditorialCard.swift       — dark card surface (matches email card chrome)
│   │   ├── EditorialEyebrow.swift    — uppercase brand label above headings
│   │   ├── EditorialButton.swift     — solid brand-fill action button
│   │   └── EditorialDivider.swift    — subtle hairline divider
│   └── Resources/                    — color assets (.xcassets)
└── Package.swift
```

## Naming Convention

- All public types prefixed with `Editorial`
- View modifier functions prefixed with `.editorial…()`
- Tokens are `public static let` on enums, never instantiated

## Design Principles

- Dark theme only — body `#030d14`, card `#071e2e`, brand `#00a6fb`, text `#edf6fc`
- No glossy bevels, no heavy shadows — clean editorial surfaces
- Letter-spaced uppercase eyebrows over big tight-tracked headings
- Generous breathing room — line-height 1.6–1.7 on body copy
- Subtle borders (`6%` white) instead of hard separators
- One brand accent (`#00a6fb`) — used for eyebrow, button fill, links

## Source of Truth

Token values mirror `client/src/emails/shell.tsx` so iOS UI, transactional email,
and the marketing site stay visually consistent. When changing a token here,
update the email shell to match.
