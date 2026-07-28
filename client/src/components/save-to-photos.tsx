"use client"

import { useCallback, useEffect, useState } from "react"
import { ImageDown, Loader2, Check } from "lucide-react"
import { optimizedJpegUrl } from "@/lib/download"
import { isVideo, type Photo } from "@/lib/types"

// a share sheet with too many images at once gets slow and can fail outright
const BATCH = 20

/**
 * Phone path for "get these into my camera roll". A zip is no use on iOS — it
 * lands in Files — so hand the images to the system share sheet instead, where
 * "Save N Images" drops them straight into Photos.
 *
 * The share call has to happen inside the tap or Safari rejects it for missing
 * user activation, so each batch is fetched ahead of time and the tap only shares.
 */
export function SaveToPhotos({ photos }: { photos: Photo[] }) {
  const stills = photos.filter((p) => !isVideo(p))
  const [saved, setSaved] = useState(0)
  const [pending, setPending] = useState<File[] | null>(null)
  const [supported, setSupported] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    try {
      const probe = new File([new Blob(["x"])], "x.jpg", { type: "image/jpeg" })
      setSupported(Boolean(navigator.canShare?.({ files: [probe] })))
    } catch {
      setSupported(false)
    }
  }, [])

  const remaining = stills.length - saved

  // warm the next batch so the tap can share immediately
  useEffect(() => {
    if (!supported || pending || remaining <= 0) return
    let cancelled = false
    const slice = stills.slice(saved, saved + BATCH)
    Promise.all(
      slice.map(async (p) => {
        const url = optimizedJpegUrl(p)
        if (!url) return null
        const res = await fetch(url)
        const blob = await res.blob()
        const base = (p.file_metadata.filename || "photo").replace(/\.[^.]+$/, "")
        return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
      })
    )
      .then((files) => {
        if (!cancelled) setPending(files.filter(Boolean) as File[])
      })
      .catch(() => {
        if (!cancelled) setPending([])
      })
    return () => {
      cancelled = true
    }
  }, [supported, pending, saved, remaining, stills])

  const share = useCallback(async () => {
    if (!pending?.length) return
    setSharing(true)
    try {
      await navigator.share({ files: pending })
      setSaved((n) => n + pending.length)
      setPending(null)
    } catch {
      // dismissing the share sheet throws AbortError — keep the batch for a retry
    } finally {
      setSharing(false)
    }
  }, [pending])

  if (!supported || stills.length === 0) return null

  const done = remaining <= 0
  const preparing = !done && pending === null

  return (
    <div className="mt-4">
      <button
        onClick={share}
        disabled={done || preparing || sharing}
        className="flex h-11 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-60"
      >
        {done ? (
          <Check className="size-3.5" />
        ) : preparing || sharing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ImageDown className="size-3.5" />
        )}
        {done
          ? `All ${stills.length} saved`
          : preparing
            ? "Preparing…"
            : `Save ${Math.min(BATCH, remaining)} to Photos`}
      </button>
      <p className="mt-2 text-[11px] text-text-faint">
        {done
          ? "Check your Photos app."
          : saved > 0
            ? `${saved} of ${stills.length} saved — tap again for the next batch.`
            : "Saves straight to your camera roll, 20 at a time."}
      </p>
    </div>
  )
}
