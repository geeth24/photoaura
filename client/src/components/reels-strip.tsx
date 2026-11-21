"use client"

import { useCallback, useState } from "react"
import { Play } from "lucide-react"
import { ReelPlayer } from "@/components/reel-player"
import { reelBox, reelLength, reelShape } from "@/lib/reels"
import type { Reel } from "@/lib/types"

type Props = {
  reels: Reel[]
  albumSlug: string
  canDownload?: boolean
}

export function ReelsStrip({ reels, albumSlug, canDownload = true }: Props) {
  const [playing, setPlaying] = useState<Reel | null>(null)
  const close = useCallback(() => setPlaying(null), [])

  return (
    <section aria-label="Reels" className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="block h-px w-8 bg-brand" />
        <h2 className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">Reels</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">{reels.length}</span>
      </div>
      {/* phones scroll the strip edge to edge; the page itself never scrolls sideways */}
      <div className="flex gap-3 overflow-x-auto pb-1 max-sm:ml-[calc(50%-50vw)] max-sm:w-screen max-sm:px-5 max-sm:[scrollbar-width:none] sm:[scrollbar-width:thin]">
        {reels.map((reel) => (
          <button
            key={reel.id}
            type="button"
            onClick={() => setPlaying(reel)}
            aria-label={`Play the ${reelShape(reel.aspect).toLowerCase()} reel${reel.duration ? `, ${reelLength(reel.duration)}` : ""}`}
            className={`group relative h-48 shrink-0 overflow-hidden bg-surface-elevated sm:h-60 ${reelBox(reel.aspect)}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reel.poster_url}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white">
              <Play className="size-3" fill="currentColor" />
              {reelLength(reel.duration)}
            </span>
          </button>
        ))}
      </div>
      <ReelPlayer reel={playing} albumSlug={albumSlug} onClose={close} canDownload={canDownload} />
    </section>
  )
}
