<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design system — "Reactive Shots" editorial

This marketing site uses the same Reactive Shots editorial look as the `client/` app, so the brand reads as one product. Always match it for new sections/pages. Reference: `../reactive-shots-v3`. In-repo examples to copy from: `src/components/hero.tsx`, `src/components/features.tsx`, `src/app/policy/page.tsx`.

## Fonts
Wired in `src/app/layout.tsx` (next/font) and `src/app/globals.css`.
- `font-heading` — DM Serif Display (serif). All page titles, section titles, big numbers.
- `font-body` — Outfit (sans). Default on `<body>`.
- `font-blackmud` — local decorative display (`src/app/Blackmud-VGoOx.ttf`).
- The next/font CSS variables are `--font-dm-serif`, `--font-outfit`, `--font-blackmud-face`, set on `<html>`; Tailwind `@theme` tokens point at them. Never make a font var self-referential — it falls back to system sans.

## Colors — use tokens, NEVER hardcode hex
Defined in `src/app/globals.css` (dark default + `.light`). Corners are sharp everywhere (`--radius: 0`).
- Surfaces: `bg-surface`, `bg-surface-elevated`, `bg-surface-card`, `bg-surface-hover`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-faint`
- Borders: `border-border-subtle`, `border-border-default`, `border-border-strong`
- Brand: `text-brand` / `bg-brand` (+ `brand-light`, `brand-dark`). shadcn tokens (`bg-card`, `text-muted-foreground`, etc.) also wired.

## Patterns (copy verbatim)
- **Eyebrow label:** `<span className="block h-px w-12 bg-brand" />` next to `<span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">LABEL</span>`
- **Page heading:** `font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tight text-text-primary`; subtext `font-light text-text-secondary`
- **Primary/brand button:** `flex h-12 items-center gap-2 bg-brand px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)]`
- **Secondary nav link:** `text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary`
- **Card grid divider trick:** `grid gap-px border border-border-subtle bg-border-subtle` containing `bg-surface-elevated p-8` children produces hairline-divided editorial blocks
- **Motion:** `import { motion } from "motion/react"`; fade/slide-in `initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.5, ease:[0.22,1,0.36,1]}}`. For scroll-revealed sections, swap `animate` for `whileInView` + `viewport={{ once: true, margin: '-100px' }}`
- **Grain texture:** `grain` class on hero/CTA sections; brand radial glows `bg-brand/20 blur-[160px]`

## Conventions
- React function components; lowercase-dash filenames, PascalCase component names; bun for packages
- Always use globals.css color variables, never hardcoded Tailwind colors
- Short, humanized comments only — no "this fixes X" preamble
- **lucide-react v1.x removed brand icons** — for GitHub etc., use the inline mark in `src/components/icons.tsx` (or add new inline SVGs there)
- next-themes `attribute="class"` with `defaultTheme="dark"` — dark is the showcase; `.light` overrides cover the light pass
