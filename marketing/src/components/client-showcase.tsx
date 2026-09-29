"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { Check } from "lucide-react"
import { AppStoreBadge } from "@/components/app-store-badge"

const perks = [
  "A sign-in link by email — no passwords to lose",
  "Their galleries, the moment you mark them ready",
  "Download everything as one zip, or photo by photo",
  "On iPhone, save the whole album to the camera roll",
]

const ease = [0.22, 1, 0.36, 1] as const

export function ClientShowcase() {
  return (
    <section id="clients" className="relative overflow-hidden border-t border-border-subtle bg-surface py-28 lg:py-36">
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[32rem] w-[32rem] rounded-full bg-brand/15 blur-[170px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-[1.25fr_1fr] lg:px-10">
        {/* their web gallery behind, the iPhone app in front */}
        <div className="relative order-last lg:order-first">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="ml-auto w-[88%]"
          >
            <Image
              src="/mockups/client-mac.webp"
              alt="A client's home page on a MacBook — “Hi Priya. Your gallery is ready.”"
              width={2309}
              height={1860}
              sizes="(max-width: 1024px) 88vw, 620px"
              className="h-auto w-full"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            className="absolute bottom-[-6%] left-0 w-[34%]"
          >
            <Image
              src="/mockups/app-home.webp"
              alt="The PhotoAura iPhone app home screen with the client's gallery"
              width={896}
              height={1660}
              sizes="(max-width: 1024px) 34vw, 240px"
              className="h-auto w-full"
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease }}
        >
          <div className="mb-6 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              For your clients
            </span>
          </div>
          <h2 className="pb-[0.15em] font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tight text-text-primary">
            A gallery they
            <br />
            <span className="text-brand">actually open.</span>
          </h2>
          <p className="mt-6 max-w-md text-[15px] font-light leading-[1.8] text-text-secondary">
            Clients land on their photos, not a login wall. On the web or in the
            iPhone app, it&apos;s the same gallery with your name on it.
          </p>

          <ul className="mt-10 space-y-3 border-t border-border-subtle pt-8">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[14px] text-text-secondary">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <AppStoreBadge className="mt-10" />
        </motion.div>
      </div>
    </section>
  )
}
