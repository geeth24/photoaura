"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, EyeOff, Loader2, Plus, Undo2, X } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { tileSrc } from "@/components/photo-grid"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { isVideo, type Photo, type SmartGallery, type SmartReason } from "@/lib/types"

const REASONS: { key: SmartReason; label: string; hint: string }[] = [
  { key: "blurry", label: "Blurry", hint: "Soft faces, or a soft frame with no people" },
  { key: "eyes_closed", label: "Eyes closed", hint: "The main subject blinked" },
  { key: "duplicate", label: "Duplicates", hint: "Not the best of their stack" },
]

const eyebrow = "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"
const grid = "grid grid-cols-3 gap-[3px] sm:grid-cols-5 lg:grid-cols-7"
const overlayButton =
  "flex items-center gap-1 bg-black/55 px-2 py-1.5 text-[9px] font-medium uppercase tracking-[0.15em] text-white backdrop-blur transition-colors hover:text-brand"

type Props = {
  albumSlug: string
  photos: Photo[]
  onOpen: (photo: Photo) => void
  // the client-facing highlights changed
  onChanged?: () => void
}

export function SmartGalleryPanel({ albumSlug, photos, onOpen, onChanged }: Props) {
  const [smart, setSmart] = useState<SmartGallery | null>(null)
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState(false)
  const base = `/album/${albumSlug}/smart`

  const byName = useMemo(
    () => new Map(photos.map((p) => [p.file_metadata.filename, p])),
    [photos],
  )

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout>
    const load = () =>
      apiFetch<SmartGallery>(base)
        .then((s) => {
          if (!live) return
          setSmart(s)
          if (s.status === "scoring") timer = setTimeout(load, 3000)
        })
        .catch(() => live && toast.error("Couldn't load the smart view"))
    load()
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [base])

  const send = useCallback(
    async (path: string, body: object, reload = true) => {
      setBusy(true)
      try {
        setSmart(await apiFetch<SmartGallery>(`${base}${path}`, { method: "POST", body: JSON.stringify(body) }))
        if (reload) onChanged?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn't save")
      } finally {
        setBusy(false)
      }
    },
    [base, onChanged],
  )

  if (!smart) {
    return (
      <div className="flex items-center gap-3 py-16 text-text-muted">
        <Loader2 className="size-4 animate-spin text-brand" />
        <span className="text-[11px] uppercase tracking-[0.2em]">Loading</span>
      </div>
    )
  }

  if (smart.status !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-border-default px-6 py-20 text-center">
        {smart.status === "scoring" && <Loader2 className="mb-4 size-5 animate-spin text-brand" />}
        <p className="font-heading text-2xl text-text-primary">
          {smart.status === "scoring" ? "Scoring your photos" : "Nothing scored yet"}
        </p>
        <p className="mt-2 max-w-sm text-sm font-light text-text-muted">
          {smart.status === "scoring"
            ? "Highlights, stacks and the review pile show up here when it finishes."
            : "Photos uploaded with face detection on are scored automatically."}
        </p>
      </div>
    )
  }

  const thumb = (name: string) => byName.get(name)
  const inHighlights = new Set(smart.highlights)
  const addable = photos.filter((p) => !isVideo(p) && !inHighlights.has(p.file_metadata.filename))

  return (
    <div className="space-y-14">
      <div className="flex flex-wrap items-center justify-between gap-4 border border-border-default px-4 py-3.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
            Publish highlights
          </p>
          <p className="mt-1 text-xs font-light text-text-muted">
            Clients get a Highlights · All switch at the top of their gallery.
          </p>
        </div>
        <label className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-text-secondary">
          {smart.published ? "Published" : "Not published"}
          <Switch
            checked={smart.published}
            disabled={busy}
            onCheckedChange={(published) => send("/publish", { published })}
            aria-label="Publish highlights to the client"
          />
        </label>
      </div>

      <Section
        title="Highlights"
        note={`${smart.counts.highlights} of ${smart.counts.photos}`}
        action={
          <button onClick={() => setPicker(true)} className={`${overlayButton} bg-transparent text-text-secondary`}>
            <Plus className="size-3" />
            Add
          </button>
        }
      >
        <div className={grid}>
          {smart.highlights.map((name) => {
            const p = thumb(name)
            if (!p) return null
            return (
              <Tile key={name} photo={p} onOpen={onOpen} tag={smart.manual.add.includes(name) ? "Added" : undefined}>
                <button
                  onClick={() => send("/highlights", { remove: [name] })}
                  disabled={busy}
                  aria-label="Remove from highlights"
                  className="absolute right-1.5 top-1.5 bg-black/55 p-1.5 text-white backdrop-blur transition-colors hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </Tile>
            )
          })}
        </div>
      </Section>

      <Section title="Stacks" note={`${smart.counts.stacks} groups of near-identical shots`}>
        {smart.stacks.length === 0 ? (
          <Empty>No burst shots found.</Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {smart.stacks.map((st) => (
              <StackRow
                key={st.id}
                stack={st}
                thumb={thumb}
                onOpen={onOpen}
                busy={busy}
                onBest={(filename) => send("/stacks/best", { filename })}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Review" note={`${smart.counts.review} to look at`}>
        <div className="space-y-8">
          {REASONS.map(({ key, label, hint }) => {
            const items = smart.review[key]
            if (!items.length) return null
            return (
              <div key={key} className="space-y-3">
                <p className="flex flex-wrap items-baseline gap-x-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
                  {label}
                  <span className="font-normal text-text-faint">{items.length}</span>
                  <span className="text-[10px] font-light normal-case tracking-normal text-text-faint">{hint}</span>
                </p>
                <div className={grid}>
                  {items.map(({ filename, hidden }) => {
                    const p = thumb(filename)
                    if (!p) return null
                    return (
                      <Tile key={filename} photo={p} onOpen={onOpen} dim={hidden} tag={hidden ? "Hidden" : undefined}>
                        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-px">
                          {hidden ? (
                            <button
                              onClick={() => send("/review", { clear: [filename] })}
                              disabled={busy}
                              className={overlayButton}
                            >
                              <Undo2 className="size-3" />
                              Show
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => send("/review", { hide: [filename] })}
                                disabled={busy}
                                aria-label="Hide from the client"
                                className={overlayButton}
                              >
                                <EyeOff className="size-3" />
                                <span className="hidden sm:inline">Hide</span>
                              </button>
                              <button
                                onClick={() => send("/review", { keep: [filename] })}
                                disabled={busy}
                                aria-label="Keep in the gallery"
                                className={overlayButton}
                              >
                                <Check className="size-3" />
                                <span className="hidden sm:inline">Keep</span>
                              </button>
                            </>
                          )}
                        </div>
                      </Tile>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {smart.counts.review === 0 && <Empty>Nothing flagged.</Empty>}
          {smart.kept.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
                Kept <span className="font-normal text-text-faint">{smart.kept.length}</span>
              </p>
              <div className={grid}>
                {smart.kept.map((name) => {
                  const p = thumb(name)
                  if (!p) return null
                  return (
                    <Tile key={name} photo={p} onOpen={onOpen}>
                      <button
                        onClick={() => send("/review", { clear: [name] })}
                        disabled={busy}
                        className={`${overlayButton} absolute bottom-0 right-0`}
                      >
                        <Undo2 className="size-3" />
                        Undo
                      </button>
                    </Tile>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              Add to highlights
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-[3px] sm:grid-cols-5">
            {addable.map((p) => (
              <button
                key={p.file_metadata.filename}
                disabled={busy}
                onClick={() => {
                  send("/highlights", { add: [p.file_metadata.filename] })
                  setPicker(false)
                }}
                className="group relative aspect-square overflow-hidden bg-surface-elevated"
                aria-label="Add to highlights"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tileSrc(p)} alt="" loading="lazy" className="size-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus className="size-5 text-white" />
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string
  note: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="block h-px w-8 bg-brand" />
        <h2 className={eyebrow}>{title}</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">{note}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed border-border-default px-4 py-8 text-center text-sm font-light text-text-muted">
      {children}
    </p>
  )
}

function Tile({
  photo,
  onOpen,
  dim,
  tag,
  size,
  children,
}: {
  photo: Photo
  onOpen: (p: Photo) => void
  dim?: boolean
  tag?: string
  size?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`group relative aspect-square overflow-hidden bg-surface-elevated ${size ?? ""}`}>
      <button
        type="button"
        onClick={() => onOpen(photo)}
        className="absolute inset-0 block size-full cursor-zoom-in"
        aria-label={photo.file_metadata.description || photo.file_metadata.filename}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tileSrc(photo)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`size-full object-cover transition-opacity ${dim ? "opacity-35" : ""}`}
        />
      </button>
      {tag && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-white backdrop-blur">
          {tag}
        </span>
      )}
      {children}
    </div>
  )
}

function StackRow({
  stack,
  thumb,
  onOpen,
  onBest,
  busy,
}: {
  stack: SmartGallery["stacks"][number]
  thumb: (name: string) => Photo | undefined
  onOpen: (p: Photo) => void
  onBest: (filename: string) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const best = thumb(stack.best)
  if (!best) return null
  return (
    <div className="border border-border-default">
      <div className="flex items-center gap-4 p-3">
        <Tile photo={best} onOpen={onOpen} size="size-20 shrink-0 sm:size-24" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
            Best of {stack.members.length}
          </p>
          <p className="mt-1 text-xs font-light text-text-muted">Shot within seconds of each other</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-9 items-center gap-1.5 border border-border-default px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {open ? "Hide" : "Swap"}
          <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-4 gap-[3px] border-t border-border-subtle p-3 sm:grid-cols-5">
          {stack.members.map((name) => {
            const p = thumb(name)
            if (!p) return null
            const isBest = name === stack.best
            return (
              <Tile key={name} photo={p} onOpen={onOpen} tag={isBest ? "Best" : undefined}>
                {!isBest && (
                  <button
                    onClick={() => onBest(name)}
                    disabled={busy}
                    className={`${overlayButton} absolute inset-x-0 bottom-0 justify-center`}
                  >
                    <Check className="size-3" />
                    Make best
                  </button>
                )}
              </Tile>
            )
          })}
        </div>
      )}
    </div>
  )
}
