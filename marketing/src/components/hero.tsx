"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { GithubMark } from "@/components/icons"

export function Hero() {
  return (
    <section className="grain relative overflow-hidden bg-surface">
      {/* brand radial glows */}
      <div className="pointer-events-none absolute -left-32 top-32 h-[36rem] w-[36rem] rounded-full bg-brand/20 blur-[160px]" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[36rem] w-[36rem] rounded-full bg-brand/10 blur-[180px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-24 lg:px-10 lg:pt-28 lg:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-6 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Open Source · Self-Hosted
            </span>
          </div>

          <h1 className="overflow-hidden">
            <motion.span
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="block font-heading text-[clamp(3rem,9vw,7rem)] leading-[0.85] tracking-tight text-text-primary"
            >
              Your photos,
            </motion.span>
            <motion.span
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="block font-heading text-[clamp(3rem,9vw,7rem)] leading-[0.85] tracking-tight text-brand"
            >
              beautifully managed.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-8 max-w-xl text-[15px] font-light leading-[1.8] text-text-secondary"
          >
            A quiet, editorial home for the photos you actually care about.
            Self-hosted on your hardware. Face recognition, galleries, and shared
            albums — without the surveillance.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href="https://github.com/geeth24/photoaura"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-12 items-center justify-center gap-2 bg-brand px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)]"
            >
              <GithubMark className="size-4" />
              Get Started
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/#features"
              className="flex h-12 items-center justify-center px-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary"
            >
              See features
            </Link>
          </motion.div>
        </motion.div>

        {/* screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-20 lg:mt-28"
        >
          <div className="absolute inset-x-0 -top-12 mx-auto h-32 max-w-3xl bg-brand/20 blur-[100px]" />
          <div className="relative overflow-hidden border border-border-default bg-surface-elevated">
            <Image
              src="/web.png"
              alt="PhotoAura app screenshot"
              width={2432}
              height={1442}
              className="w-full"
              priority
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
