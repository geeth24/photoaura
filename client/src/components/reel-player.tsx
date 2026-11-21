"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Download, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { downloadReel } from "@/lib/download"
import { reelShape } from "@/lib/reels"
import type { Reel } from "@/lib/types"

type Props = {
  reel: Reel | null
  albumSlug: string
  onClose: () => void
  canDownload?: boolean
}

const chrome =
  "flex h-10 items-center justify-center gap-2 rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"

export function ReelPlayer({ reel, albumSlug, onClose, canDownload = true }: Props) {
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!reel) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.documentElement.style.overflow = ""
    }
  }, [reel, onClose])

  if (!reel) return null

  const save = async () => {
    setSaving(true)
    try {
      await downloadReel(reel, albumSlug)
    } catch {
      toast.error("Couldn't download the reel")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${reelShape(reel.aspect)} reel`}
      className="fixed inset-0 z-[45] flex items-center justify-center bg-black px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[calc(max(env(safe-area-inset-top),12px)+52px)] sm:px-10 sm:pb-8 sm:pt-20"
      onClick={onClose}
    >
      <div className="absolute inset-x-3 top-[max(env(safe-area-inset-top),12px)] flex items-center justify-between sm:inset-x-6 sm:top-5">
        <button onClick={onClose} aria-label="Close" autoFocus className={`${chrome} size-10`}>
          <X className="size-5" />
        </button>
        {canDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              save()
            }}
            disabled={saving}
            className={`${chrome} px-4 text-[11px] font-semibold uppercase tracking-[0.2em] disabled:opacity-60`}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download
          </button>
        )}
      </div>
      <video
        key={reel.id}
        src={reel.url}
        poster={reel.poster_url}
        controls
        controlsList={canDownload ? undefined : "nodownload"}
        autoPlay
        playsInline
        onClick={(e) => e.stopPropagation()}
        style={{ aspectRatio: `${reel.width} / ${reel.height}` }}
        className="max-h-full max-w-full bg-black"
      />
    </div>,
    document.body,
  )
}
