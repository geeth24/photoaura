"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import { ChevronsLeftRight, Layers, X } from "lucide-react"
import { Eyebrow, Lede, SectionTitle } from "@/components/demo-ui"

const ease = [0.22, 1, 0.36, 1] as const

const points = [
  "Upload a revision and only the changed photos move to v2. Nothing else in the gallery shifts.",
  "Your client gets an email with your note and can show just the updated photos.",
  "Drag across any photo to compare versions. Keyboard arrows work too.",
]

// the viewer's Compare: v1 under v2, a divider you drag
function CompareFrame() {
  const [pos, setPos] = useState(42)
  const frame = useRef<HTMLDivElement>(null)

  const moveTo = (clientX: number) => {
    const r = frame.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    const next =
      e.key === "ArrowLeft" ? pos - step : e.key === "ArrowRight" ? pos + step : e.key === "Home" ? 0 : e.key === "End" ? 100 : null
    if (next == null) return
    e.preventDefault()
    setPos(Math.min(100, Math.max(0, next)))
  }

  return (
    <div className="relative bg-black px-4 pb-6 pt-16 sm:px-10 sm:pb-10 sm:pt-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md">
          <X className="size-4" />
        </span>
        <div className="pt-0.5 text-center text-white">
          <p className="text-[14px] font-medium leading-tight">Compare</p>
          <p className="mt-0.5 text-[11px] text-white/60">Drag the line, or use the arrow keys</p>
        </div>
        <span className="size-9" />
      </div>

      <div
        ref={frame}
        className="relative mx-auto aspect-[2/3] max-h-[560px] cursor-ew-resize touch-none select-none overflow-hidden"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          moveTo(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e.clientX)
        }}
      >
        <Image src="/demo/wed-bride.webp" alt="Version 2 of Sofia's portrait" fill sizes="(max-width: 1024px) 90vw, 420px" className="object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Image src="/demo/wed-bride-v1.webp" alt="Version 1 of the same portrait" fill sizes="(max-width: 1024px) 90vw, 420px" className="object-cover" />
        </div>
        <span className="pointer-events-none absolute left-3 top-3 bg-black/55 px-2 py-1 text-[11px] font-semibold tracking-[0.12em] text-white backdrop-blur">
          v1
        </span>
        <span className="pointer-events-none absolute right-3 top-3 bg-black/55 px-2 py-1 text-[11px] font-semibold tracking-[0.12em] text-white backdrop-blur">
          v2
        </span>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare v1 with v2"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKeyDown}
          className="group absolute inset-y-0 -ml-5 flex w-10 justify-center outline-none"
          style={{ left: `${pos}%` }}
        >
          <span className="h-full w-px bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.6)]" />
          <span className="absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/70 backdrop-blur-md transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-brand">
            <ChevronsLeftRight className="size-4" />
          </span>
        </div>
      </div>
    </div>
  )
}

export function CompareDemo() {
  return (
    <section id="revisions" className="border-t border-border-subtle bg-surface py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease }}
        >
          <Eyebrow className="mb-6">Revisions</Eyebrow>
          <SectionTitle>
            Edits land in place.
            <br />
            <span className="text-brand">They see what changed.</span>
          </SectionTitle>
          <Lede className="mt-6 max-w-lg">
            When a client asks for changes, you upload just those photos. PhotoAura keeps every version and lets
            anyone drag between them.
          </Lede>
          <ul className="mt-10 border-t border-border-subtle">
            {points.map((p, i) => (
              <li key={p} className="flex gap-5 border-b border-border-subtle py-4">
                <span className="pt-0.5 text-[10px] font-medium uppercase tracking-[0.3em] text-text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[14px] font-light leading-[1.7] text-text-secondary">{p}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease }}
          className="space-y-3"
        >
          {/* the banner clients see on the album */}
          <div className="flex flex-wrap items-center justify-between gap-4 border border-l-2 border-border-subtle border-l-brand bg-surface-elevated px-5 py-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <Layers className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-text-primary">
                  Revision 2<span className="text-text-muted"> · 6 photos updated</span>
                </p>
                <p className="mt-1 text-sm font-light text-text-secondary">
                  Warmer skin tones on the portraits, and the exit sign is gone behind the arch.
                </p>
              </div>
            </div>
            <span className="flex h-9 shrink-0 items-center border border-border-default px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
              Show only these
            </span>
          </div>
          <CompareFrame />
        </motion.div>
      </div>
    </section>
  )
}
