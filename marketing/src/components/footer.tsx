import Image from "next/image"
import Link from "next/link"
import { GithubMark } from "@/components/icons"

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo-color.png" alt="PhotoAura" width={28} height={28} />
          <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-text-muted">
            PhotoAura
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-6 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
          <Link href="/#features" className="transition-colors hover:text-text-primary">
            Features
          </Link>
          <Link href="/policy" className="transition-colors hover:text-text-primary">
            Privacy
          </Link>
          <Link
            href="mailto:info@radsoftinc.com"
            className="transition-colors hover:text-text-primary"
          >
            Contact
          </Link>
          <Link
            href="https://github.com/geeth24/photoaura"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-text-primary"
          >
            <GithubMark className="size-3.5" />
            GitHub
          </Link>
        </nav>

        <p className="text-[10px] uppercase tracking-[0.25em] text-text-faint">
          © {new Date().getFullYear()} Rad Soft, Inc.
        </p>
      </div>
    </footer>
  )
}
