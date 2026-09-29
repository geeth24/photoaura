"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { GithubMark } from "@/components/icons"
import { ContactDialog } from "@/components/contact-dialog"

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
              For Photographers · Open Source
            </span>
          </div>

          {/* pb leaves room for descenders so "y" and "g" don't clip on tight leading */}
          <h1 className="overflow-hidden pb-[0.15em]">
            <motion.span
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="block font-heading text-[clamp(3rem,9vw,7rem)] leading-[0.95] tracking-tight text-text-primary"
            >
              Your photos,
            </motion.span>
            <motion.span
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="block font-heading text-[clamp(3rem,9vw,7rem)] leading-[0.95] tracking-tight text-brand"
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
            An editorial photo home built for working photographers. Client
            galleries that feel like Photos, face recognition, and an iPhone app
            your clients actually use. Hosted by us, or self-host the source.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <ContactDialog intent="studio">
              <button className="group flex h-12 cursor-pointer items-center justify-center gap-2 bg-brand px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)]">
                Talk to us
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </ContactDialog>
            <Link
              href="https://github.com/geeth24/photoaura"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 border border-border-default px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <GithubMark className="size-4" />
              Self-host
            </Link>
          </motion.div>
        </motion.div>

        {/* studio on a Mac, the client's app in front */}
        <div className="relative mt-16 lg:mt-24">
          <div className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto h-64 max-w-4xl bg-brand/20 blur-[120px]" />
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-[86%] lg:ml-[4%] lg:w-[76%]"
          >
            <Image
              src="/mockups/hero-mac.webp"
              alt="PhotoAura studio on a MacBook — a wedding album with its people and photo grid"
              width={2465}
              height={1808}
              sizes="(max-width: 1024px) 88vw, 1000px"
              className="h-auto w-full"
              priority
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 80, rotate: 4 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 1.1, delay: 1.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-[2%] bottom-[-4%] w-[28%] lg:right-[14%] lg:w-[21%]"
          >
            <Image
              src="/mockups/app-viewer.webp"
              alt="The PhotoAura iPhone app showing a photo from a client's gallery"
              width={929}
              height={1656}
              sizes="(max-width: 1024px) 30vw, 300px"
              className="h-auto w-full"
              priority
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
