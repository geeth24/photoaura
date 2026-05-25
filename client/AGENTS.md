<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design system — "Reactive Shots" editorial

The client uses the Reactive Shots editorial look. Match it for **all** new UI. Reference repo: `../reactive-shots-v3`. In-repo examples to copy from: `src/app/login/page.tsx`, `src/app/(dashboard)/albums/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`.

## Fonts
Wired in `src/app/layout.tsx` (next/font) and `src/app/globals.css`.
- `font-heading` — DM Serif Display (serif). Use for page titles, card titles, big stat numbers.
- `font-body` — Outfit (sans). Default on `<body>`; the everyday text font.
- `font-blackmud` — local decorative display; rarely used.
- The next/font CSS variables are `--font-dm-serif`, `--font-outfit`, `--font-blackmud-face`, defined on `<html>`; the Tailwind `@theme` tokens (`--font-heading/body/sans/blackmud`) point at them.
- **Gotcha:** never make a font var self-referential (e.g. `--font-body: var(--font-body)`) — it silently falls back to system sans. Point theme tokens at the distinct next/font vars.

## Colors — use tokens, NEVER hardcode hex
All defined in `src/app/globals.css` (dark default + `.light`). Corners are sharp everywhere (`--radius: 0`).
- Surfaces: `bg-surface`, `bg-surface-elevated`, `bg-surface-card`, `bg-surface-hover`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-faint`
- Borders: `border-border-subtle`, `border-border-default`, `border-border-strong`
- Brand: `text-brand` / `bg-brand` (+ `brand-light`, `brand-dark`). Standard shadcn tokens also exist.

## Patterns (copy verbatim)
- **Eyebrow label:** `<span className="block h-px w-12 bg-brand" />` next to `<span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">LABEL</span>`
- **Page heading:** `font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary`; subtext `text-sm font-light text-text-secondary`
- **Primary/brand button:** `flex h-11 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50`
- **Secondary button:** `border border-border-default px-5 text-[11px] uppercase tracking-[0.2em] text-text-secondary hover:border-border-strong hover:text-text-primary`
- **Micro-labels** (form labels, counts): `text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted`
- **Image/cover cards:** `overflow-hidden border border-border-subtle bg-surface-elevated`; image `transition-transform duration-700 group-hover:scale-105`; gradient scrim `bg-gradient-to-t from-surface/90 via-surface/15 to-transparent`; serif title overlaid bottom-left
- **Empty states:** `border border-dashed border-border-default py-16 text-center` + icon + serif line + muted subtext
- **Motion:** `import { motion } from "motion/react"`; fade/slide-in `initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.5, ease:[0.22,1,0.36,1]}}`; light stagger (`delay: Math.min(i*0.05, 0.4)`), don't over-animate large grids
- **Grain texture:** add the `grain` class on brand panels

## Conventions
- React function components; lowercase-dash filenames, PascalCase component names; bun for packages
- Always use globals.css color variables, never hardcoded Tailwind colors
- Short, humanized comments only
- Verify any new page/screen renders against the live backend (kubectl port-forward `svc/photoaura-backend 8000`) before considering it done
- The `/website` section (formerly CMS) manages the public reactiveshots.com gallery via the API — one featured album per category
