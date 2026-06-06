"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { apiFetch } from "@/lib/api"
import type { Face, Photo } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Pencil, ArrowLeft, ImageOff, UserRound, Merge } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

type Suggestion = {
  external_id: string
  name: string | null
  similarity: number
  count: number
  image_url: string
}

export default function FacesPage() {
  const [faces, setFaces] = useState<Face[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Face | null>(null)
  const [facePhotos, setFacePhotos] = useState<Photo[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editFace, setEditFace] = useState<Face | null>(null)
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [merging, setMerging] = useState<string | null>(null)

  const fetchFaces = () => {
    setLoading(true)
    apiFetch<Face[]>("/faces")
      .then(setFaces)
      .catch(() => setFaces([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFaces()
  }, [])

  const viewFace = async (face: Face) => {
    setSelected(face)
    setPhotosLoading(true)
    setSuggestions([])
    setSuggestionsLoading(true)
    try {
      const detail = await apiFetch<Face>(`/face/${face.external_id}`)
      setFacePhotos(detail.face_photos || [])
    } catch {
      setFacePhotos([])
    } finally {
      setPhotosLoading(false)
    }
    // "AI thinks these might be the same person" — surfaced for manual merge
    apiFetch<Suggestion[]>(`/face/${face.external_id}/suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false))
  }

  const mergeInto = async (sourceId: string) => {
    if (!selected || merging) return
    setMerging(sourceId)
    try {
      await apiFetch("/faces/merge", {
        method: "POST",
        body: JSON.stringify({
          target_face_id: selected.external_id,
          source_face_ids: [sourceId],
        }),
      })
      toast.success("Merged — same person")
      setSuggestions((prev) => prev.filter((s) => s.external_id !== sourceId))
      // refresh this person's photos (they just gained the merged shots)
      viewFace(selected)
      fetchFaces()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't merge")
    } finally {
      setMerging(null)
    }
  }

  const openEdit = (face: Face) => {
    setEditFace(face)
    setEditName(face.name || "")
    setEditOpen(true)
  }

  const saveName = async () => {
    if (!editFace) return
    setSaving(true)
    try {
      await apiFetch(`/face/${editFace.external_id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName }),
      })
      toast.success("Name updated")
      setEditOpen(false)
      fetchFaces()
      if (selected?.external_id === editFace.external_id) {
        setSelected({ ...selected, name: editName })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update name")
    } finally {
      setSaving(false)
    }
  }

  // detail view for a face
  if (selected) {
    return (
      <div className="space-y-12">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <button
              onClick={() => setSelected(null)}
              className="group mb-4 flex items-center gap-4 text-text-muted transition-colors hover:text-text-primary"
            >
              <span className="block h-px w-12 bg-brand" />
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
                <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
                Faces
              </span>
            </button>

            <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
              {selected.name || "Unknown"}
            </h1>

            <p className="mt-3 text-sm font-light text-text-secondary">
              {photosLoading
                ? "Loading photos…"
                : `${facePhotos.length} ${facePhotos.length === 1 ? "photo" : "photos"}`}
            </p>
          </div>

          <button
            onClick={() => openEdit(selected)}
            className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Pencil className="size-3.5" />
            Edit Name
          </button>
        </div>

        {/* similar people — AI suggestions to merge */}
        {(suggestionsLoading || suggestions.length > 0) && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="block h-px w-12 bg-brand" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                Might be the same person
              </span>
            </div>
            {suggestionsLoading ? (
              <div className="flex gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="size-24" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {suggestions.map((s) => (
                  <div
                    key={s.external_id}
                    className="group w-24 space-y-1.5 text-center"
                  >
                    <div className="relative size-24 overflow-hidden border border-border-subtle bg-surface-elevated">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.image_url}
                        alt=""
                        className="size-full object-cover"
                      />
                      <span className="absolute right-1 top-1 bg-surface/80 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-text-primary backdrop-blur">
                        {s.similarity}%
                      </span>
                    </div>
                    <p className="truncate text-[10px] uppercase tracking-[0.15em] text-text-muted">
                      {s.name || `${s.count} photo${s.count === 1 ? "" : "s"}`}
                    </p>
                    <button
                      onClick={() => mergeInto(s.external_id)}
                      disabled={merging === s.external_id}
                      className="flex w-full items-center justify-center gap-1 bg-brand py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-surface transition-all hover:bg-text-primary disabled:opacity-50"
                    >
                      <Merge className="size-3" />
                      {merging === s.external_id ? "…" : "Merge"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* photo grid */}
        {photosLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : facePhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
            <ImageOff className="size-7 text-text-faint" />
            <p className="mt-4 font-heading text-xl text-text-primary">
              No photos for this face
            </p>
            <p className="mt-1 text-sm font-light text-text-muted">
              This person has not appeared in any photos yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {facePhotos.map((photo, i) => (
              <motion.div
                key={photo.compressed_image}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: Math.min(i * 0.02, 0.3),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group relative aspect-square overflow-hidden border border-border-subtle bg-surface-elevated"
              >
                <Image
                  src={photo.compressed_image}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </motion.div>
            ))}
          </div>
        )}

        <EditSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          name={editName}
          onNameChange={setEditName}
          onSave={saveName}
          saving={saving}
        />
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              People
            </span>
          </div>
          <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
            Faces
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            {loading
              ? "Loading people…"
              : `${faces.length} ${faces.length === 1 ? "person" : "people"}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : faces.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
          <UserRound className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">No faces found</p>
          <p className="mt-1 text-sm font-light text-text-muted">
            Faces appear here once your photos have been processed.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {faces.map((face, i) => (
            <motion.div
              key={face.external_id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: Math.min(i * 0.05, 0.4),
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <button
                onClick={() => viewFace(face)}
                className="group block w-full text-left"
              >
                <div className="relative aspect-square w-full overflow-hidden border border-border-subtle bg-surface-elevated">
                  {face.image_url ? (
                    <Image
                      src={face.image_url}
                      alt={face.name || "Unknown face"}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-text-faint">
                      <UserRound className="size-6" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/15 to-transparent" />

                  {/* edit pencil reveals on hover */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(face)
                    }}
                    className="absolute right-3 top-3 border border-border-strong bg-surface/70 p-1.5 text-text-secondary opacity-0 backdrop-blur transition-all hover:text-text-primary group-hover:opacity-100"
                    aria-label="Edit name"
                  >
                    <Pencil className="size-3" />
                  </span>

                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h2 className="line-clamp-1 font-heading text-lg leading-tight tracking-tight text-text-primary">
                      {face.name || "Unknown"}
                    </h2>
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <EditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        name={editName}
        onNameChange={setEditName}
        onSave={saveName}
        saving={saving}
      />
    </div>
  )
}

function EditSheet({
  open,
  onOpenChange,
  name,
  onNameChange,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="font-heading text-xl text-text-primary">
            Edit Face
          </SheetTitle>
          <SheetDescription className="text-sm font-light text-text-secondary">
            Update the name for this face.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
              Name
            </span>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Person name"
            />
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex h-10 items-center justify-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:opacity-60 disabled:hover:bg-brand disabled:hover:shadow-none"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
