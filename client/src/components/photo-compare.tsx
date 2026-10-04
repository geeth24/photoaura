"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronsLeftRight, X } from "lucide-react"
import { FULL_WIDTH, TILE_WIDTH } from "@/components/photo-grid"
import cdnImageLoader from "@/lib/cdn-image-loader"
import type { PhotoVersion } from "@/lib/types"

type Pad = { top: number; bottom: number; left: number; right: number }

// one frame big enough for both fitted versions, so a cropped or rotated edit
// gets letterboxed instead of shifting the divider
function frameFor(a: PhotoVersion, b: PhotoVersion, pad: Pad) {
  const aw = window.innerWidth - pad.left - pad.right
  const ah = window.innerHeight - pad.top - pad.bottom
  const fit = (v: PhotoVersion) => {
    const w = v.width || 1600
    const h = v.height || 1067
    const s = Math.min(aw / w, ah / h)
    return { w: w * s, h: h * s }
  }
  const fa = fit(a)
  const fb = fit(b)
  const w = Math.max(fa.w, fb.w)
  const h = Math.max(fa.h, fb.h)
  return { w, h, x: pad.left + (aw - w) / 2, y: pad.top + (ah - h) / 2 }
}

export function PhotoCompare({
  versions,
  pad,
  onClose,
}: {
  // oldest first; the last one is what the gallery shows now
  versions: PhotoVersion[]
  pad: Pad
  onClose: () => void
}) {
  const after = versions[versions.length - 1]
  const earlier = versions.slice(0, -1)
  const [beforeVersion, setBeforeVersion] = useState(earlier[earlier.length - 1].version)
  const before = earlier.find((v) => v.version === beforeVersion) ?? earlier[earlier.length - 1]
  const [pos, setPos] = useState(50)
  const [, setViewport] = useState(0)
  const frameRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth * 10000 + window.innerHeight)
    window.addEventListener("resize", onResize)
    // arrows work straight away, no click needed
    handleRef.current?.focus({ preventScroll: true })
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const frame = frameFor(before, after, pad)

  const moveTo = (clientX: number) => {
    const r = frameRef.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    const next =
      e.key === "ArrowLeft"
        ? pos - step
        : e.key === "ArrowRight"
          ? pos + step
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 100
              : null
    if (next == null) return
    e.preventDefault()
    setPos(Math.min(100, Math.max(0, next)))
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 bg-black">
      <div
        ref={frameRef}
        className="absolute cursor-ew-resize touch-none select-none"
        style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          moveTo(e.clientX)
          handleRef.current?.focus({ preventScroll: true })
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e.clientX)
        }}
      >
        <Layer version={after} />
        <div
          className="absolute inset-0 bg-black"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <Layer version={before} />
        </div>

        <span className="pointer-events-none absolute left-3 top-3 bg-black/55 px-2 py-1 text-[11px] font-semibold tracking-[0.12em] text-white backdrop-blur">
          v{before.version}
        </span>
        <span className="pointer-events-none absolute right-3 top-3 bg-black/55 px-2 py-1 text-[11px] font-semibold tracking-[0.12em] text-white backdrop-blur">
          v{after.version}
        </span>

        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label={`Compare v${before.version} with v${after.version}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% v${before.version}`}
          onKeyDown={onKeyDown}
          className="group absolute inset-y-0 -ml-5 flex w-10 justify-center outline-none"
          style={{ left: `${pos}%` }}
        >
          <span className="h-full w-px bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.6)]" />
          <span className="absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md ring-1 ring-white/70 transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-brand">
            <ChevronsLeftRight className="size-4" />
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-3 pb-12 pt-[max(env(safe-area-inset-top),12px)] sm:px-6 sm:pt-5">
        <button
          onClick={onClose}
          aria-label="Close compare"
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
        <div className="min-w-0 pt-1 text-center text-white">
          <p className="text-[15px] font-medium leading-tight">Compare</p>
          <p className="mt-0.5 text-[12px] text-white/65">Drag the line, or use the arrow keys</p>
        </div>
        <span className="size-10" />
      </div>

      {earlier.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/75 via-black/30 to-transparent pb-[max(env(safe-area-inset-bottom),14px)] pt-10">
          <div className="flex items-center gap-0.5 rounded-full bg-white/10 p-0.5 text-white backdrop-blur-md">
            <span className="px-3 text-[10px] uppercase tracking-[0.2em] text-white/60">
              Compare v{after.version} with
            </span>
            {earlier.map((v) => {
              const on = v.version === before.version
              return (
                <button
                  key={v.version}
                  onClick={() => setBeforeVersion(v.version)}
                  aria-pressed={on}
                  className={`h-7 rounded-full px-3 text-[12px] font-semibold tracking-[0.08em] transition-colors ${
                    on ? "bg-white text-black" : "text-white/75 hover:text-white"
                  }`}
                >
                  v{v.version}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// full-size version over its thumbnail, which shows until the big one lands
function Layer({ version }: { version: PhotoVersion }) {
  const full = cdnImageLoader({ src: version.image, width: FULL_WIDTH })
  const thumb = cdnImageLoader({ src: version.compressed_image, width: TILE_WIDTH })
  const [loaded, setLoaded] = useState<string | null>(null)
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={full}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(full)}
        className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ${
          loaded === full ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  )
}
