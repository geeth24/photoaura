"use client"

import { useEffect, useRef } from "react"
import { motion } from "motion/react"
import { Play } from "lucide-react"
import { Eyebrow, Lede, SectionTitle } from "@/components/demo-ui"

const ease = [0.22, 1, 0.36, 1] as const

const strip = [
  { poster: "/demo/reel-poster.webp", length: "0:20", wide: false, label: "Vertical reel, 0:20" },
  { poster: "/demo/reel-wide-poster.webp", length: "0:20", wide: true, label: "Horizontal reel, 0:20" },
]

const facts = [
  ["15–30 s", "Long enough for the day, short enough to post"],
  ["9:16 or 16:9", "Vertical for stories, wide for the big screen"],
  ["Faces in frame", "The camera moves around people, never through them"],
]

export function ReelsDemo() {
  const video = useRef<HTMLVideoElement>(null)

  // plays only while it's on screen
  useEffect(() => {
    const v = video.current
    if (!v) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.35 },
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])

  return (
    <section id="reels" className="border-t border-border-subtle bg-surface-elevated py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
          className="lg:order-2"
        >
          <Eyebrow className="mb-6">Reels</Eyebrow>
          <SectionTitle>
            Every gallery
            <br />
            <span className="text-brand">comes with a reel.</span>
          </SectionTitle>
          <Lede className="mt-6 max-w-lg">
            PhotoAura builds a short music video from the Highlights, spread across the whole day. Pick a track,
            choose the shape, and publish it to the client&apos;s gallery, ready to download and share.
          </Lede>
          <dl className="mt-10 grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k} className="bg-surface p-5">
                <dt className="font-heading text-xl tracking-tight text-text-primary">{k}</dt>
                <dd className="mt-2 text-[12px] font-light leading-[1.6] text-text-secondary">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease }}
          className="space-y-4 lg:order-1"
        >
          <div className="flex items-center gap-4">
            <span className="block h-px w-8 bg-brand" />
            <h3 className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">Reels</h3>
            <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">{strip.length}</span>
          </div>
          <div className="flex items-end gap-3">
            {/* the vertical reel, playing */}
            <div className="relative aspect-[9/16] w-[48%] shrink-0 overflow-hidden bg-surface sm:w-[44%]">
              <video
                ref={video}
                src="/demo/reel.mp4"
                poster={strip[0].poster}
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="A vertical reel made from the wedding's Highlights"
                className="size-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white">
                <Play className="size-3" fill="currentColor" />
                {strip[0].length}
              </span>
            </div>
            <div className="relative aspect-video min-w-0 flex-1 overflow-hidden bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={strip[1].poster} alt={strip[1].label} loading="lazy" className="size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white">
                <Play className="size-3" fill="currentColor" />
                {strip[1].length}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
