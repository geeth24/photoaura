"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { Eyebrow, Lede, SectionTitle } from "@/components/demo-ui"
import { StoreBadges } from "@/components/store-badges"

const ease = [0.22, 1, 0.36, 1] as const

const points = [
  ["Highlights and Moments", "The same sorted gallery as the web, built natively for iPhone and Android."],
  ["Save it all to Photos", "One tap puts the whole gallery in the camera roll, no zip files on a phone."],
  ["Compare with a swipe", "Revisions show up in place, with every version a drag away."],
  ["One account everywhere", "Picks, People and downloads follow the client from the app to the browser."],
]

export function AppsSection() {
  return (
    <section id="apps" className="relative overflow-hidden border-t border-border-subtle bg-surface-elevated py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
        >
          <Eyebrow className="mb-6">iPhone and Android</Eyebrow>
          <SectionTitle>
            Their gallery,
            <br />
            <span className="text-brand">in their pocket.</span>
          </SectionTitle>
          <Lede className="mt-6 max-w-md">
            Most clients open their photos on a phone. The PhotoAura apps make that the best way to see them,
            and they&apos;re free for your clients.
          </Lede>
          <ul className="mt-10 grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2">
            {points.map(([title, body]) => (
              <li key={title} className="bg-surface p-5">
                <h3 className="font-heading text-lg leading-tight text-text-primary">{title}</h3>
                <p className="mt-1.5 text-[13px] font-light leading-[1.65] text-text-secondary">{body}</p>
              </li>
            ))}
          </ul>
          <StoreBadges className="mt-10" />
        </motion.div>

        <div className="relative mx-auto flex w-full max-w-lg items-start justify-center">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="relative z-0 mt-14 w-[52%]"
          >
            <Image
              src="/mockups/ios-home.webp"
              alt="The PhotoAura iPhone app's home screen with the client's galleries"
              width={896}
              height={1660}
              sizes="(max-width: 1024px) 48vw, 280px"
              className="h-auto w-full"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 90 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, delay: 0.15, ease }}
            className="relative z-10 -ml-[8%] w-[54%]"
          >
            <Image
              src="/mockups/ios-viewer.webp"
              alt="A photo open full screen in the PhotoAura iPhone app"
              width={929}
              height={1656}
              sizes="(max-width: 1024px) 50vw, 290px"
              className="h-auto w-full"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
