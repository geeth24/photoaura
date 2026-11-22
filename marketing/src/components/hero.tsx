"use client"

import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { ContactDialog } from "@/components/contact-dialog"
import { AlbumDemo } from "@/components/album-demo"
import { Eyebrow, brandButton, ghostButton } from "@/components/demo-ui"

const ease = [0.22, 1, 0.36, 1] as const

export function Hero() {
  return (
    <section className="relative bg-surface">
      <div className="mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-10 lg:pb-28 lg:pt-24">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-end lg:gap-14">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
            <Eyebrow className="mb-7">Client galleries for photographers</Eyebrow>
            <h1 className="pb-[0.12em] font-heading text-[clamp(2.9rem,7.2vw,5.75rem)] leading-[0.95] tracking-tight text-text-primary">
              Galleries that
              <br />
              <span className="text-brand">sort themselves.</span>
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
            className="lg:pb-3"
          >
            <p className="max-w-md text-[15px] font-light leading-[1.8] text-text-secondary">
              Upload the whole wedding. PhotoAura finds the people, picks the Highlights, splits the day into
              Moments and cuts a reel, so your client opens a gallery that already makes sense. On the web, iPhone
              and Android.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ContactDialog intent="studio">
                <button className={brandButton}>
                  Talk to us
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </ContactDialog>
              <a href="#sorting" className={ghostButton}>
                How it works
              </a>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease }}
          className="mt-14 lg:mt-20"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.25em] text-text-faint">
            <span>The client&apos;s view · try a face or a view</span>
            <span>Every person here is made up</span>
          </div>
          <AlbumDemo />
        </motion.div>
      </div>
    </section>
  )
}
