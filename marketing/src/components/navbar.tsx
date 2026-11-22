"use client"

import Image from "next/image"
import Link from "next/link"
import { ModeToggle } from "./mode-toggle"
import { ContactDialog } from "@/components/contact-dialog"

const links = [
  { label: "Galleries", href: "/#sorting" },
  { label: "Reels", href: "/#reels" },
  { label: "Revisions", href: "/#revisions" },
  { label: "Payments", href: "/#payments" },
  { label: "Apps", href: "/#apps" },
]

// the same top bar the gallery app uses: hairline, wordmark, quiet uppercase links
export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-5 sm:px-6 lg:px-10">
        <div className="flex h-full items-center gap-8 lg:gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-color.png" alt="" width={26} height={26} preload />
            <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-text-primary">PhotoAura</span>
          </Link>
          <nav className="hidden h-full items-stretch md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center px-3 text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted transition-colors hover:text-text-primary lg:px-3.5"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <ModeToggle />
          <ContactDialog intent="studio">
            <button className="flex h-9 cursor-pointer items-center bg-brand px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-surface transition-colors hover:bg-text-primary">
              Talk to us
            </button>
          </ContactDialog>
        </div>
      </div>
    </header>
  )
}
