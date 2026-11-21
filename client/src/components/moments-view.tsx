"use client"

import { PhotoGrid } from "@/components/photo-grid"
import { momentRange, spansDays } from "@/lib/moments"
import type { Moment, Photo } from "@/lib/types"

export type MomentGroup = { moment: Moment; photos: Photo[] }

type Props = {
  groups: MomentGroup[]
  onOpen: (photo: Photo) => void
  favorites?: Set<string>
  onToggleFavorite?: (filename: string) => void
}

// one section per moment; the header stays under the top bar while its grid scrolls
export function MomentsView({ groups, onOpen, favorites, onToggleFavorite }: Props) {
  const withDate = spansDays(groups.map((g) => g.moment))

  return (
    <div className="space-y-8">
      {groups.map(({ moment, photos }, i) => (
        <section key={moment.key} aria-label={moment.label}>
          <header className="sticky top-[var(--client-top,0px)] z-10 mb-3 flex items-baseline justify-between gap-4 border-b border-border-subtle bg-surface/90 py-2.5 backdrop-blur-xl max-sm:ml-[calc(50%-50vw)] max-sm:w-screen max-sm:px-5">
            <h2 className="flex min-w-0 items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
              <span className="block h-px w-6 shrink-0 bg-brand" />
              <span className="truncate">{moment.label}</span>
            </h2>
            <p className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-text-faint">
              {momentRange(moment, withDate)}
              <span className="px-1.5">·</span>
              {photos.length}
            </p>
          </header>
          <PhotoGrid
            photos={photos}
            onOpen={onOpen}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            controls={i === 0}
          />
        </section>
      ))}
    </div>
  )
}
