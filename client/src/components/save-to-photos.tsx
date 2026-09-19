"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
export function SaveToPhotos({
  photos,
  albumSlug,
}: {
  photos: Photo[]
  albumSlug: string
}) {
  // memoised — this drives an effect, and a fresh array each render would refetch
  const stills = useMemo(() => photos.filter((p) => !isVideo(p)), [photos])
  const key = `aura:saved-to-photos:${albumSlug}`

  const [saved, setSaved] = useState(0)
  const [pending, setPending] = useState<File[] | null>(null)
  const [supported, setSupported] = useState(false)
  const [sharing, setSharing] = useState(false)
  // don't prefetch until we know where they left off, or we'd fetch the wrong batch
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    try {
      const probe = new File([new Blob(["x"])], "x.jpg", { type: "image/jpeg" })
      setSupported(Boolean(navigator.canShare?.({ files: [probe] })))
    } catch {
      setSupported(false)
    }
  }, [])

  // iOS routinely discards the tab while you're in the Photos app — pick the
  // count back up so nobody re-saves the first twenty all over again
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(key) || 0)
      if (n > 0) setSaved(Math.min(n, stills.length))
    } catch {
      // private mode / storage disabled — just start from zero
    }
    setRestored(true)
  }, [key, stills.length])

  useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem(key, String(saved))
    } catch {
      // ignore
    }
  }, [saved, key, restored])

  const remaining = stills.length - saved

  // warm the next batch so the tap can share immediately
  useEffect(() => {
    if (!supported || !restored || pending || remaining <= 0) return
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
  }, [supported, restored, pending, saved, remaining, stills])

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

  const startOver = () => {
    setSaved(0)
    setPending(null)
  }

  if (!supported || stills.length === 0) return null

  const done = remaining <= 0
  const preparing = !done && pending === null

  const [spotlit, setSpotlit] = useState(false)
  useEffect(() => {
    if (!supported || window.location.hash !== "#save") return
    setSpotlit(true)
    const el = document.getElementById("save")
    const t = setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block: "center" }), 250)
    return () => clearTimeout(t)
  }, [supported])

  return (
    <div id="save" className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={share}
          disabled={done || preparing || sharing}
          className={`flex h-11 items-center gap-2 border px-5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors disabled:opacity-60 ${
            spotlit && !done
              ? "border-brand bg-brand text-surface shadow-[0_0_40px_rgba(0,166,251,0.35)] hover:bg-text-primary"
              : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
          }`}
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
        {saved > 0 && (
          <button
            onClick={startOver}
            className="text-[10px] uppercase tracking-[0.2em] text-text-faint transition-colors hover:text-text-secondary"
          >
            Start over
          </button>
        )}
      </div>
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
