"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, ImageOff, Merge, Pencil, UserRound, X } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import type { Album, Face, Photo } from "@/lib/types"
import { plural } from "@/lib/format"
import { PhotoGrid } from "@/components/photo-grid"
import { usePhotoViewer } from "@/hooks/use-photo-viewer"
import { Skeleton } from "@/components/ui/skeleton"
import { brandButton, quietButton, SectionLabel } from "@/components/page-header"

const NONE: Photo[] = []

type Suggestion = { external_id: string; name: string | null; similarity: number; count: number; image_url: string }

export function FaceChip({ src, name, className }: { src?: string; name: string | null; className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden border border-border-subtle bg-surface-elevated ${className ?? ""}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? "Unnamed person"} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-text-faint">
          <UserRound className="size-6" />
        </div>
      )}
    </div>
  )
}

// one person: rename, the albums they're in, likely duplicates, every photo
export function FaceDetail({
  face,
  albums,
  onBack,
  onChanged,
}: {
  face: Face
  albums: Map<number | undefined, Album>
  onBack: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState(face.name)
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [merging, setMerging] = useState<string | null>(null)
  const { open: openPhoto, viewers } = usePhotoViewer(photos ?? NONE)

  const load = useCallback(() => {
    apiFetch<Face>(`/face/${face.external_id}`)
      .then((d) => setPhotos(d.face_photos ?? []))
      .catch(() => setPhotos([]))
    apiFetch<Suggestion[]>(`/face/${face.external_id}/suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
  }, [face.external_id])

  useEffect(() => {
    load()
  }, [load])

  const albumIds = [...new Set((photos ?? []).map((p) => p.file_metadata.album_id))]

  const merge = async (sourceId: string) => {
    setMerging(sourceId)
    try {
      await apiFetch("/faces/merge", {
        method: "POST",
        body: JSON.stringify({ target_face_id: face.external_id, source_face_ids: [sourceId] }),
      })
      toast.success("Merged — same person")
      setSuggestions((prev) => prev?.filter((s) => s.external_id !== sourceId) ?? null)
      load()
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't merge")
    } finally {
      setMerging(null)
    }
  }

  return (
    <div className="space-y-12">
      <div>
        <button
          onClick={onBack}
          className="group mb-6 flex items-center gap-4 text-text-muted transition-colors hover:text-text-primary"
        >
          <span className="block h-px w-12 bg-brand" />
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
            <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
            Faces
          </span>
        </button>
        <div className="flex flex-wrap items-end gap-6">
          <FaceChip src={face.image_url} name={name} className="size-28 sm:size-32" />
          <div className="min-w-0 flex-1">
            <NameEditor face={face} name={name} onSaved={(n) => { setName(n); onChanged() }} />
            <p className="mt-3 text-sm font-light text-text-secondary">
              {photos == null ? "Loading photos…" : `${plural(photos.length, "photo")} across ${plural(albumIds.length, "album")}`}
            </p>
            {albumIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {albumIds.map((id) => {
                  const a = albums.get(id)
                  return a ? (
                    <Link
                      key={id}
                      href={`/albums/${a.slug}`}
                      className="border border-border-default px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:border-brand hover:text-brand"
                    >
                      {a.album_name}
                    </Link>
                  ) : null
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {(suggestions == null || suggestions.length > 0) && (
        <section className="space-y-4">
          <SectionLabel>Might be the same person</SectionLabel>
          {suggestions == null ? (
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-28" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {suggestions.map((s) => (
                <div key={s.external_id} className="flex w-60 items-center gap-3 border border-border-subtle bg-surface-elevated p-3">
                  <FaceChip src={s.image_url} name={s.name} className="size-16" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-sm text-text-primary">{s.name ?? "Unnamed"}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-text-faint">
                      {s.similarity}% match · {plural(s.count, "photo")}
                    </p>
                    <button
                      onClick={() => merge(s.external_id)}
                      disabled={merging != null}
                      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-brand transition-colors hover:text-text-primary disabled:opacity-50"
                    >
                      <Merge className="size-3" />
                      {merging === s.external_id ? "Merging…" : "Merge in"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {photos == null ? (
        <div className="grid grid-cols-3 gap-[3px] sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
          <ImageOff className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">No photos for this person</p>
        </div>
      ) : (
        <PhotoGrid photos={photos} onOpen={openPhoto} />
      )}

      {viewers}
    </div>
  )
}

function NameEditor({ face, name, onSaved }: { face: Face; name: string | null; onSaved: (name: string) => void }) {
  const [editing, setEditing] = useState(!name)
  const [draft, setDraft] = useState(name ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const next = draft.trim()
    if (!next) return
    setSaving(true)
    try {
      await saveFaceName(face.external_id, next)
      onSaved(next)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing)
    return (
      <div className="flex items-start gap-3">
        <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">{name}</h1>
        <button onClick={() => setEditing(true)} aria-label="Rename" className="mt-2 text-text-faint transition-colors hover:text-brand">
          <Pencil className="size-4" />
        </button>
      </div>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="flex max-w-md items-center gap-2"
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Who is this?"
        className="h-12 min-w-0 flex-1 border-b border-border-strong bg-transparent font-heading text-3xl text-text-primary placeholder:text-text-faint focus:border-brand focus:outline-none"
      />
      <button type="submit" disabled={saving || !draft.trim()} className={brandButton} aria-label="Save name">
        <Check className="size-3.5" />
      </button>
      {name && (
        <button type="button" onClick={() => setEditing(false)} className={quietButton} aria-label="Cancel">
          <X className="size-3.5" />
        </button>
      )}
    </form>
  )
}

export async function saveFaceName(id: string, name: string) {
  try {
    await apiFetch(`/face/${id}`, { method: "PUT", body: JSON.stringify({ name }) })
    toast.success(`Named ${name}`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Couldn't save the name")
    throw e
  }
}
