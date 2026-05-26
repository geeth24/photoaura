"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight, Check } from "lucide-react"
import { GithubMark } from "@/components/icons"

const paths = [
  {
    eyebrow: "Hosted by Rad Soft",
    title: "We deploy it for you.",
    body: "Tell us your domain, your storage, and your branding. We stand up a managed PhotoAura instance for your studio — updates, backups, and uptime on us.",
    bullets: [
      "Managed instance on your subdomain",
      "Storage of your choice (S3, R2, our cloud)",
      "Brand colors and logo on the gallery",
      "We handle updates + monitoring",
    ],
    cta: {
      label: "Talk to us",
      href: "mailto:info@radsoftinc.com?subject=PhotoAura%20managed%20instance",
      brand: true,
    },
  },
  {
    eyebrow: "Self-host",
    title: "Or run it on your own box.",
    body: "Clone the repo, run the stack, own the operation. The source is open and the docs walk you through it.",
    bullets: [
      "One-command Docker stack",
      "AWS S3, R2, MinIO, or local disk",
      "Postgres + face recognition included",
      "MIT licensed",
    ],
    cta: {
      label: "View on GitHub",
      href: "https://github.com/geeth24/photoaura",
      brand: false,
    },
  },
]

export function Ship() {
  return (
    <section className="border-t border-border-subtle bg-surface py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-6 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Two ways to ship
            </span>
          </div>
          <h2 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tight text-text-primary">
            Have us run it,
            <br />
            <span className="text-brand">or run it yourself.</span>
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-3 lg:grid-cols-2">
          {paths.map((p, i) => (
            <motion.div
              key={p.eyebrow}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-col gap-6 border border-border-subtle bg-surface-elevated p-8 lg:p-10"
            >
              <div className="flex items-center gap-3">
                <span className="block h-px w-8 bg-brand" />
                <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                  {p.eyebrow}
                </span>
              </div>

              <h3 className="font-heading text-3xl leading-tight tracking-tight text-text-primary lg:text-4xl">
                {p.title}
              </h3>

              <p className="text-[14px] font-light leading-[1.75] text-text-secondary">
                {p.body}
              </p>

              <ul className="mt-2 space-y-3 border-t border-border-subtle pt-6">
                {p.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 text-[13px] text-text-secondary"
                  >
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex">
                <Link
                  href={p.cta.href}
                  target={p.cta.href.startsWith("http") ? "_blank" : undefined}
                  rel={p.cta.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className={
                    p.cta.brand
                      ? "group flex h-11 items-center justify-center gap-2 bg-brand px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)]"
                      : "group flex h-11 items-center justify-center gap-2 border border-border-default px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  }
                >
                  {!p.cta.brand && <GithubMark className="size-4" />}
                  {p.cta.label}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
