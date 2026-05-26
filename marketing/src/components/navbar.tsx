"use client"

import Image from "next/image"
import Link from "next/link"
import { ModeToggle } from "./mode-toggle"

const links = [
  { label: "Features", href: "/#features" },
  { label: "Privacy", href: "/policy" },
  { label: "GitHub", href: "https://github.com/geeth24/photoaura", external: true },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <Image
            src="/logo-color.png"
            alt="PhotoAura"
            width={32}
            height={32}
            priority
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-text-secondary transition-colors group-hover:text-text-primary">
            PhotoAura
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
