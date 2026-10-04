"use client"

import { Layers } from "lucide-react"
import type { Revision } from "@/lib/types"

export function RevisionBanner({
  revision,
  showing,
  onShow,
}: {
  revision: Revision
  // revision currently filtering the grid, if any
  showing: number | null
  onShow: (number: number | null) => void
}) {
  const on = showing === revision.number
  const older = showing != null && !on
  const count = `${revision.photo_count} ${revision.photo_count === 1 ? "photo" : "photos"} updated`

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-border-subtle border-l-brand border-l-2 bg-surface-elevated px-5 py-4">
      <div className="flex min-w-0 items-start gap-3.5">
        <Layers className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-text-primary">
            {older ? `Showing revision ${showing}` : `Revision ${revision.number}`}
            {!older && <span className="text-text-muted"> · {count}</span>}
          </p>
          {!older && revision.note && (
            <p className="mt-1 text-sm font-light text-text-secondary">{revision.note}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onShow(on || older ? null : revision.number)}
        className={`flex h-9 shrink-0 items-center border px-4 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors ${
          on
            ? "border-brand text-brand"
            : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
        }`}
      >
        {on || older ? "Show all photos" : "Show only these"}
      </button>
    </div>
  )
}
