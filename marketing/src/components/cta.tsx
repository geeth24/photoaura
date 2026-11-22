"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { ContactDialog } from "@/components/contact-dialog"
import { GithubMark } from "@/components/icons"
import { Eyebrow, brandButton, ghostButton } from "@/components/demo-ui"

const ease = [0.22, 1, 0.36, 1] as const
const strip = ["wed-makeup", "wed-aisle", "wed-kiss", "wed-bluff", "wed-veil", "wed-firstdance", "wed-sparklers"]

export function Cta() {
  return (
    <section className="border-t border-border-subtle bg-surface">
      {/* a last row of the gallery, edge to edge */}
      <div className="grid grid-cols-4 gap-[2px] sm:grid-cols-7 sm:gap-[3px]">
        {strip.map((id, i) => (
          <div key={id} className={`relative aspect-square overflow-hidden bg-surface-elevated ${i > 3 ? "max-sm:hidden" : ""}`}>
            <Image src={`/demo/${id}.webp`} alt="" fill sizes="(max-width: 640px) 25vw, 15vw" className="object-cover" />
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-6 lg:px-10 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
          className="mx-auto max-w-3xl text-center"
        >
          <Eyebrow className="mb-7 justify-center">Your next delivery</Eyebrow>
          <h2 className="pb-[0.1em] font-heading text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.95] tracking-tight text-text-primary">
            Send the gallery
            <br />
            <span className="text-brand">they&apos;ll keep opening.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] font-light leading-[1.8] text-text-secondary">
            We set PhotoAura up on your domain with your branding and storage, and keep it running. The code is
            open source too, if you&apos;d rather host it yourself.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <ContactDialog intent="studio">
              <button className={brandButton}>
                Talk to us
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </ContactDialog>
            <Link
              href="https://github.com/geeth24/photoaura"
              target="_blank"
              rel="noopener noreferrer"
              className={ghostButton}
            >
              <GithubMark className="size-4" />
              Self-host
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
