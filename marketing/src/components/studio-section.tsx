"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { ArrowUpRight, Plus } from "lucide-react"
import { Eyebrow, Lede, SectionTitle } from "@/components/demo-ui"
import { PHOTOS } from "@/lib/demo"

const ease = [0.22, 1, 0.36, 1] as const

const ALBUMS = [
  { name: "Sofia & Daniel", photos: PHOTOS.length, cover: "wed-bluff" },
  { name: "Priya & Arjun", photos: 10, cover: "eng-oak" },
  { name: "The Okafor Family", photos: 6, cover: "fam-blanket" },
  { name: "Mai · Class of 2026", photos: 5, cover: "grad-toss" },
  { name: "Northwind Headshots", photos: 6, cover: "por-team" },
  { name: "Ember Roasters", photos: 6, cover: "brand-pour" },
]

const tools = [
  ["Drop a whole shoot", "Drag photos and clips onto an album. Faces, Highlights and Moments are worked out in the background while you carry on."],
  ["Invite the client", "Clients sign in with a link from their email. No password to set, nothing to forget."],
  ["Private or public", "Share a private link, or make a gallery public for your portfolio. Change it any time."],
  ["Films and files", "Attach the highlight film or a print release to an album. The client gets an email when it lands."],
  ["Your website", "Each category on your public site shows one featured album, straight from PhotoAura."],
  ["See what they see", "Open any gallery as the client, even as it will look once the final payment clears."],
]

// the studio's albums page, the screen everything starts from
function AlbumsScreen() {
  return (
    <div className="border border-border-default bg-surface shadow-[0_40px_120px_-40px_rgba(0,0,0,0.45)]">
      <div className="flex h-12 items-center gap-3 border-b border-border-subtle px-5 sm:h-14 sm:px-6">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="h-4 w-px bg-border-subtle" />
        <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">Studio</span>
      </div>
      <div className="space-y-8 p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-4">
              <span className="block h-px w-12 bg-brand" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">Library</span>
            </div>
            <p className="font-heading text-[clamp(2rem,3.4vw,2.75rem)] leading-[0.95] tracking-tight text-text-primary">Albums</p>
            <p className="mt-2 text-sm font-light text-text-secondary">{ALBUMS.length} collections</p>
          </div>
          <span className="flex h-10 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface">
            <Plus className="size-3.5" />
            New Album
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {ALBUMS.map((a, i) => (
            <div key={a.name} className="group relative aspect-[4/3] overflow-hidden border border-border-subtle bg-surface-elevated">
              <Image
                src={`/demo/${a.cover}.webp`}
                alt=""
                fill
                sizes="(max-width: 1024px) 45vw, 260px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/15 to-transparent" />
              <ArrowUpRight className="absolute right-3 top-3 size-4 -translate-y-1 text-brand opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-brand/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-0.5 line-clamp-1 font-heading text-base leading-tight tracking-tight text-text-primary sm:text-lg">
                  {a.name}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-text-muted">{a.photos} photos</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StudioSection() {
  return (
    <section id="studio" className="border-t border-border-subtle bg-surface py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-10">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease }}
          >
            <Eyebrow className="mb-6">For the studio</Eyebrow>
            <SectionTitle>
              Every shoot.
              <br />
              <span className="text-brand">Every client.</span>
            </SectionTitle>
            <Lede className="mt-6 max-w-md">
              The studio side is the same calm, editorial app: your albums, your clients and your bookings, with
              the busywork done in the background.
            </Lede>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
          >
            <AlbumsScreen />
          </motion.div>
        </div>

        <ul className="mt-16 grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(([title, body], i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.06, ease }}
              className="bg-surface-elevated p-6 sm:p-7"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 font-heading text-xl leading-tight text-text-primary">{title}</h3>
              <p className="mt-2 text-[13px] font-light leading-[1.7] text-text-secondary">{body}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
