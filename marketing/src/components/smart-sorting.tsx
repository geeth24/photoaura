"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { Sparkles, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { MOMENTS, PEOPLE, PHOTOS, faceSrc, momentRange, src } from "@/lib/demo"
import { Eyebrow, Lede, SectionTitle } from "@/components/demo-ui"

const ease = [0.22, 1, 0.36, 1] as const

function PeopleVisual() {
  return (
    <div className="flex flex-wrap gap-3">
      {PEOPLE.map((p, i) => (
        <div key={p.id} className="space-y-1.5 text-center">
          <span
            className={cn(
              "relative block size-14 overflow-hidden border",
              i === 0 ? "border-brand shadow-[0_0_30px_rgba(0,166,251,0.25)]" : "border-border-subtle",
            )}
          >
            <Image src={faceSrc(p.id)} alt="" fill sizes="56px" className="object-cover" />
          </span>
          <span className="block text-[9px] uppercase tracking-[0.15em] text-text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

// a burst of near-identical frames, and the one PhotoAura keeps
function StackVisual() {
  const crops = ["50% 30%", "46% 34%", "54% 28%", "50% 38%"]
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">Best of 4</p>
      <div className="grid grid-cols-4 gap-[3px]">
        {crops.map((pos, i) => (
          <div key={pos} className="relative aspect-square overflow-hidden bg-surface-elevated">
            <Image
              src={src("wed-kiss")}
              alt=""
              fill
              sizes="80px"
              style={{ objectPosition: pos, transform: `scale(${1.15 + i * 0.04})` }}
              className={cn("object-cover", i > 0 && "opacity-45")}
            />
            {i === 0 && (
              <span className="absolute left-1 top-1 bg-brand px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-surface">
                Best
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Blurry", "Eyes closed", "Duplicates"].map((r) => (
          <span
            key={r}
            className="border border-border-default px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-text-muted"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  )
}

function MomentsVisual() {
  return (
    <ul className="divide-y divide-border-subtle border-y border-border-subtle">
      {MOMENTS.map((m) => {
        const photos = PHOTOS.filter((p) => p.moment === m.key)
        return (
          <li key={m.key} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-primary">
              <span className="block h-px w-4 shrink-0 bg-brand" />
              <span className="truncate">{m.label}</span>
            </span>
            <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-text-faint">
              {momentRange(photos)} · {photos.length}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const cards = [
  {
    icon: Users,
    label: "People",
    title: "Everyone finds themselves.",
    body: "Faces are grouped on your own server. Guests tap their face and see every photo they're in. Name someone once and the name follows them to every album.",
    visual: <PeopleVisual />,
  },
  {
    icon: Sparkles,
    label: "Highlights",
    title: "The best frames open first.",
    body: "Bursts stack into one pick, and soft frames and blinks go to a review pile. What's left becomes Highlights, and you add or drop any photo before you publish.",
    visual: <StackVisual />,
  },
  {
    icon: null,
    label: "Moments",
    title: "The day, in the order it happened.",
    body: "Getting ready, the ceremony, portraits, the party. The gallery splits itself by time and scene and names each part. Rename any of them in a click.",
    visual: <MomentsVisual />,
  },
]

export function SmartSorting() {
  return (
    <section id="sorting" className="border-t border-border-subtle bg-surface py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
          className="max-w-2xl"
        >
          <Eyebrow className="mb-6">Sorted on upload</Eyebrow>
          <SectionTitle>
            Drop in 800 photos.
            <br />
            <span className="text-brand">They open on the best&nbsp;80.</span>
          </SectionTitle>
          <Lede className="mt-6 max-w-xl">
            Clients don&apos;t scroll a wedding from frame one to frame eight hundred. PhotoAura sorts the
            gallery while it uploads, so they land on the best of the day and can go anywhere from there.
          </Lede>
        </motion.div>

        <div className="mt-14 grid gap-px border border-border-subtle bg-border-subtle lg:grid-cols-3">
          {cards.map((c, i) => (
            <motion.article
              key={c.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease }}
              className="flex flex-col gap-8 bg-surface-elevated p-6 sm:p-8"
            >
              <div>
                <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-brand">
                  {c.icon && <c.icon className="size-3" />}
                  {c.label}
                </p>
                <h3 className="mt-4 font-heading text-2xl leading-tight tracking-tight text-text-primary">{c.title}</h3>
                <p className="mt-3 text-[14px] font-light leading-[1.75] text-text-secondary">{c.body}</p>
              </div>
              <div className="mt-auto">{c.visual}</div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
