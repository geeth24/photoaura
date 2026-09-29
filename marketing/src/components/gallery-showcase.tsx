"use client"

import Image from "next/image"
import { motion } from "motion/react"

const points = [
  {
    title: "Tap and it grows",
    body: "The whole grid zooms into the photo you picked, and folds back into place when you close it.",
  },
  {
    title: "A strip to scrub",
    body: "Drag the thumbnail strip to fly through a session. Swipe, pinch to zoom, pull down to close.",
  },
  {
    title: "Pinch the grid",
    body: "Bigger tiles for one look, a dense wall for the whole day. The grid remembers.",
  },
  {
    title: "A link per photo",
    body: "Every photo has its own address, so “the third one on the beach” is a link, not a description.",
  },
]

const ease = [0.22, 1, 0.36, 1] as const

export function GalleryShowcase() {
  return (
    <section id="gallery" className="relative overflow-hidden border-t border-border-subtle bg-surface py-28 lg:py-36">
      <div className="pointer-events-none absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-brand/10 blur-[160px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-[1fr_1.1fr] lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease }}
        >
          <div className="mb-6 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              The gallery
            </span>
          </div>
          <h2 className="pb-[0.15em] font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tight text-text-primary">
            Tap a photo.
            <br />
            <span className="text-brand">Watch it grow.</span>
          </h2>
          <p className="mt-6 max-w-md text-[15px] font-light leading-[1.8] text-text-secondary">
            Galleries that move like Photos on a phone — in any browser, with no
            app to install and no account to make.
          </p>

          <ol className="mt-12 grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2">
            {points.map((p, i) => (
              <motion.li
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.06, ease }}
                className="bg-surface-elevated p-6"
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 font-heading text-xl leading-tight text-text-primary">
                  {p.title}
                </h3>
                <p className="mt-2 text-[13px] font-light leading-[1.7] text-text-secondary">
                  {p.body}
                </p>
              </motion.li>
            ))}
          </ol>
        </motion.div>

        {/* grid on the left, the opened photo stepping forward */}
        <div className="relative mx-auto flex w-full max-w-xl items-start justify-center">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="relative z-0 mt-16 w-[52%]"
          >
            <Image
              src="/mockups/phone-album.webp"
              alt="An album on a phone — faces up top, a square photo grid below"
              width={896}
              height={1660}
              sizes="(max-width: 1024px) 50vw, 300px"
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
              src="/mockups/phone-viewer.webp"
              alt="The same album with one photo open full screen, a thumbnail strip beneath it"
              width={929}
              height={1656}
              sizes="(max-width: 1024px) 50vw, 310px"
              className="h-auto w-full"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
