"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Download,
  Loader2,
  Music,
  Play,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { downloadReel } from "@/lib/download"
import { reelBox, reelLength, reelShape } from "@/lib/reels"
import type { MusicTrack, ReelAspect, ReelPhase, StudioReel } from "@/lib/types"
import { ReelPlayer } from "@/components/reel-player"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const PHASES: Record<ReelPhase, string> = {
  queued: "Waiting its turn",
  downloading: "Gathering photos",
  preparing: "Framing shots",
  encoding: "Rendering",
  uploading: "Saving",
}
const MAX_MUSIC_BYTES = 20 * 1024 * 1024
const POLL_MS = 2000

const outline =
  "flex h-9 shrink-0 items-center justify-center gap-1.5 border border-border-default px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
const makeButton =
  "flex h-10 items-center justify-center gap-2 border border-brand px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand transition-colors hover:bg-brand hover:text-surface disabled:pointer-events-none disabled:opacity-50"
const iconButton =
  "flex size-8 items-center justify-center text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })

export function SmartReels({ albumSlug }: { albumSlug: string }) {
  const base = `/album/${albumSlug}/reels`
  const [reels, setReels] = useState<StudioReel[] | null>(null)
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [music, setMusic] = useState("")
  const [uploading, setUploading] = useState(false)
  const [starting, setStarting] = useState<ReelAspect | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [playing, setPlaying] = useState<StudioReel | null>(null)
  const [confirm, setConfirm] = useState<StudioReel | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const closePlayer = useCallback(() => setPlaying(null), [])

  const load = useCallback(
    () => apiFetch<{ reels: StudioReel[] }>(base).then((r) => setReels(r.reels)),
    [base],
  )

  useEffect(() => {
    load().catch(() => toast.error("Couldn't load the reels"))
    apiFetch<{ tracks: MusicTrack[] }>("/reels/music")
      .then((r) => setTracks(r.tracks))
      .catch(() => toast.error("Couldn't load your music"))
  }, [load])

  const rendering = !!reels?.some((r) => r.status === "rendering")
  useEffect(() => {
    if (!rendering) return
    let live = true
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      timer = setTimeout(() => {
        load()
          .catch(() => {})
          .finally(() => live && tick())
      }, POLL_MS)
    }
    tick()
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [rendering, load])

  const start = async (aspect: ReelAspect) => {
    setStarting(aspect)
    try {
      await apiFetch(base, {
        method: "POST",
        body: JSON.stringify(music ? { aspect, music_key: music } : { aspect }),
      })
      await load()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the reel")
      return false
    } finally {
      setStarting(null)
    }
  }

  const remove = async (reel: StudioReel) => {
    setReels((list) => list && list.filter((r) => r.id !== reel.id))
    try {
      await apiFetch(`${base}/${reel.id}`, { method: "DELETE" })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the reel")
      load().catch(() => {})
    }
  }

  const retry = async (reel: StudioReel) => {
    if (await start(reel.aspect)) remove(reel)
  }

  const publish = async (reel: StudioReel, published: boolean) => {
    const flip = (on: boolean) =>
      setReels((list) => list && list.map((r) => (r.id === reel.id ? { ...r, published: on } : r)))
    flip(published)
    try {
      await apiFetch(`${base}/${reel.id}`, { method: "PATCH", body: JSON.stringify({ published }) })
    } catch (e) {
      flip(!published)
      toast.error(e instanceof Error ? e.message : "That didn't save")
    }
  }

  const save = async (reel: StudioReel) => {
    setSaving(reel.id)
    try {
      await downloadReel(reel, albumSlug)
    } catch {
      toast.error("Couldn't download the reel")
    } finally {
      setSaving(null)
    }
  }

  const upload = async (file: File) => {
    if (file.size > MAX_MUSIC_BYTES) {
      toast.error("Music files can be up to 20 MB")
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const track = await apiFetch<MusicTrack>("/reels/music", { method: "POST", body: form })
      setTracks((list) => [track, ...list.filter((t) => t.key !== track.key)])
      setMusic(track.key)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload that file")
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 border border-border-default px-4 py-3.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">Make a reel</p>
          <p className="mt-1 text-xs font-light text-text-muted">
            Up to 18 highlights from across the day, 15 to 30 seconds. Clients see a reel once you publish it.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <Music className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
            <NativeSelect
              value={music}
              onChange={(e) => setMusic(e.target.value)}
              aria-label="Music"
              className="min-w-0 flex-1 sm:w-52 sm:flex-none [&_select]:h-9 [&_select]:text-[11px]"
            >
              <NativeSelectOption value="">No music</NativeSelectOption>
              {tracks.map((t) => (
                <NativeSelectOption key={t.key} value={t.key}>
                  {t.name.replace(/\.(mp3|m4a|wav)$/i, "")}
                  {t.duration ? ` · ${reelLength(t.duration)}` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              aria-label="Upload music"
              className={outline}
            >
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              Upload
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload(file)
              }}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(["9:16", "16:9"] as const).map((aspect) => (
              <button
                key={aspect}
                type="button"
                onClick={() => start(aspect)}
                disabled={!!starting}
                className={makeButton}
              >
                {starting === aspect ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : aspect === "9:16" ? (
                  <RectangleVertical className="size-3.5" />
                ) : (
                  <RectangleHorizontal className="size-3.5" />
                )}
                Make {reelShape(aspect).toLowerCase()} reel
              </button>
            ))}
          </div>
        </div>
      </div>

      {reels === null ? (
        <div className="flex items-center gap-3 py-4 text-text-muted">
          <Loader2 className="size-4 animate-spin text-brand" />
          <span className="text-[11px] uppercase tracking-[0.2em]">Loading reels</span>
        </div>
      ) : (
        reels.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {reels.map((reel) => (
              <ReelRow
                key={reel.id}
                reel={reel}
                busy={!!starting}
                saving={saving === reel.id}
                onPlay={() => setPlaying(reel)}
                onPublish={(on) => publish(reel, on)}
                onDownload={() => save(reel)}
                onDelete={() => (reel.status === "failed" ? remove(reel) : setConfirm(reel))}
                onRetry={() => retry(reel)}
              />
            ))}
          </div>
        )
      )}

      <ReelPlayer reel={playing} albumSlug={albumSlug} onClose={closePlayer} />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reel?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.published ? "It's published, so your client loses it too. " : ""}
              The video is deleted for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm) remove(confirm)
                setConfirm(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ReelRow({
  reel,
  busy,
  saving,
  onPlay,
  onPublish,
  onDownload,
  onDelete,
  onRetry,
}: {
  reel: StudioReel
  busy: boolean
  saving: boolean
  onPlay: () => void
  onPublish: (published: boolean) => void
  onDownload: () => void
  onDelete: () => void
  onRetry: () => void
}) {
  const shape = reelShape(reel.aspect)
  const size = `${reelBox(reel.aspect)} ${reel.aspect === "9:16" ? "h-28 sm:h-32" : "w-32 sm:w-44"}`
  const pct = Math.round((reel.progress ?? 0) * 100)
  const made = reel.created_at ? new Date(reel.created_at) : null

  return (
    <div className="border border-border-default">
      <div className="flex items-center gap-4 p-3">
        {reel.status === "ready" ? (
          <button
            type="button"
            onClick={onPlay}
            aria-label={`Play the ${shape.toLowerCase()} reel`}
            className={`group relative shrink-0 overflow-hidden bg-surface-elevated ${size}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reel.poster_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/45">
              <Play className="size-5 text-white" fill="currentColor" />
            </span>
          </button>
        ) : (
          <div className={`flex shrink-0 items-center justify-center bg-surface-elevated ${size}`}>
            {reel.status === "rendering" ? (
              <Loader2 className="size-5 animate-spin text-brand" />
            ) : (
              <TriangleAlert className="size-5 text-destructive" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
            {shape} reel
          </p>
          {reel.status === "ready" && (
            <p className="mt-1 text-xs font-light text-text-muted">
              {reelLength(reel.duration)}
              <span className="px-1.5">·</span>
              {reel.aspect}
              {made && !Number.isNaN(made.getTime()) && (
                <>
                  <span className="px-1.5">·</span>
                  {day.format(made)}
                </>
              )}
            </p>
          )}
          {reel.status === "rendering" && (
            <>
              <p className="mt-1 text-xs font-light text-text-muted">
                {reel.phase ? PHASES[reel.phase] : "Starting"}
                <span className="px-1.5">·</span>
                {pct}%
              </p>
              <div
                role="progressbar"
                aria-label={`${shape} reel`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="mt-2.5 h-0.5 w-full max-w-56 bg-border-subtle"
              >
                <div className="h-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
          {reel.status === "failed" && (
            <p className="mt-1 text-xs font-light text-destructive">
              Didn&apos;t finish{reel.error ? `: ${reel.error}` : ". The render stopped partway."}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-h-11 items-center gap-1 border-t border-border-subtle px-3 py-1.5">
        {reel.status === "ready" && (
          <>
            <label className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.2em] text-text-secondary">
              <Switch
                checked={reel.published}
                onCheckedChange={onPublish}
                aria-label="Publish to the client"
              />
              {reel.published ? "Published" : "Not published"}
            </label>
            <span className="ml-auto" />
            <button type="button" onClick={onDownload} disabled={saving} aria-label="Download" className={iconButton}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete reel"
              className={`${iconButton} hover:text-destructive`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
        {reel.status === "rendering" && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">
            Keeps going if you leave this page
          </span>
        )}
        {reel.status === "failed" && (
          <>
            <button
              type="button"
              onClick={onRetry}
              disabled={busy}
              className="flex h-8 items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
            >
              <RotateCcw className="size-3" />
              Retry
            </button>
            <span className="ml-auto" />
            <button
              type="button"
              onClick={onDelete}
              aria-label="Dismiss"
              className={`${iconButton} hover:text-destructive`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
