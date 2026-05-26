"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { GithubMark } from "@/components/icons"

export function Cta() {
  return (
    <section className="grain relative overflow-hidden border-t border-border-subtle bg-surface py-28 lg:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-72 max-w-4xl bg-brand/15 blur-[140px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-3xl px-6 text-center lg:px-10"
      >
        <div className="mb-6 flex items-center justify-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Set up your studio
          </span>
          <span className="block h-px w-12 bg-brand" />
        </div>

        <h2 className="overflow-hidden pb-[0.15em] font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tight text-text-primary">
          Your gallery,
          <br />
          <span className="text-brand">live this week.</span>
        </h2>

        <p className="mx-auto mt-6 max-w-md text-[15px] font-light leading-[1.8] text-text-secondary">
          Tell us about your studio and we&apos;ll deploy a branded instance — or
          clone the source and run it yourself.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="mailto:info@radsoftinc.com?subject=PhotoAura%20for%20my%20studio"
            className="group flex h-12 items-center justify-center gap-2 bg-brand px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)]"
          >
            Talk to us
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="https://github.com/geeth24/photoaura"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 border border-border-default px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <GithubMark className="size-4" />
            Self-host
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
