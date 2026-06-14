"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Album, Category, Photo } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Plus, X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react"
import { toast } from "sonner"

type CuratedPhoto = {
  photo_id: number
  album_id: number
  album_name: string
  filename: string
  compressed_image: string
}

const brandButton =
  "flex h-11 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary disabled:pointer-events-none disabled:opacity-50"

export default function CurateCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const categoryId = Number(id)
  const { user } = useAuth()

  const [category, setCategory] = useState<Category | null>(null)
  const [photos, setPhotos] = useState<CuratedPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchCurated = useCallback(() => {
    Promise.all([
      apiFetch<Category[]>("/categories"),
      apiFetch<CuratedPhoto[]>(`/categories/${categoryId}/photos`),
    ])
      .then(([cats, p]) => {
        setCategory(cats.find((c) => c.id === categoryId) ?? null)
        setPhotos(p)
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [categoryId])

  useEffect(() => {
    fetchCurated()
  }, [fetchCurated])

  const remove = async (photoId: number) => {
    setPhotos((p) => p.filter((x) => x.photo_id !== photoId))
    try {
      await apiFetch(`/categories/${categoryId}/photos/${photoId}`, { method: "DELETE" })
    } catch {
      toast.error("Couldn't remove")
      fetchCurated()
    }
  }

  // move a photo one slot left/right and persist the new order
  const move = async (index: number, dir: -1 | 1) => {
    const next = [...photos]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setPhotos(next)
    try {
      await apiFetch(`/categories/${categoryId}/photos/order`, {
        method: "PUT",
        body: JSON.stringify({ photo_ids: next.map((p) => p.photo_id) }),
      })
    } catch {
      toast.error("Couldn't reorder")
      fetchCurated()
    }
  }

  const addPhotos = async (photoIds: number[]) => {
    if (!photoIds.length) return
    setSaving(true)
    try {
      const res = await apiFetch<{ added: number }>(`/categories/${categoryId}/photos`, {
        method: "POST",
        body: JSON.stringify({ photo_ids: photoIds }),
      })
      toast.success(`Added ${res.added} ${res.added === 1 ? "photo" : "photos"}`)
      fetchCurated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href="/website"
          className="group mb-4 flex items-center gap-4 text-text-muted transition-colors hover:text-text-primary"
        >
          <span className="block h-px w-12 bg-brand" />
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
            <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
            Website
          </span>
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-[clamp(2rem,4vw,3rem)] leading-[0.95] tracking-tight text-text-primary">
              {category?.name ?? "Category"}
            </h1>
            <p className="mt-2 text-sm font-light text-text-secondary">
              {photos.length} curated {photos.length === 1 ? "photo" : "photos"} · pulled
              from any album, no duplication
            </p>
          </div>
          {user && (
            <AddPhotosDialog userId={user.id} onAdd={addPhotos} saving={saving} existing={photos} />
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <ImageOff className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-lg text-text-primary">No photos yet</p>
          <p className="mt-1 text-sm font-light text-text-muted">
            Add photos from any album — they stay in their original album, just shown here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <div
              key={p.photo_id}
              className="group relative aspect-square overflow-hidden border border-border-subtle bg-surface-elevated"
            >
              <Image
                src={p.compressed_image}
                alt={p.filename}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="absolute left-2 top-2 max-w-[80%] truncate bg-surface/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.15em] text-text-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                {p.album_name}
              </span>
              <button
                onClick={() => remove(p.photo_id)}
                className="absolute right-2 top-2 flex size-7 items-center justify-center border border-border-strong bg-surface/70 text-text-secondary opacity-0 backdrop-blur transition-all hover:text-destructive group-hover:opacity-100"
                aria-label="Remove from category"
              >
                <X className="size-3.5" />
              </button>
              <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="flex size-7 items-center justify-center border border-border-strong bg-surface/70 text-text-secondary backdrop-blur hover:text-text-primary disabled:opacity-30"
                  aria-label="Move earlier"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === photos.length - 1}
                  className="flex size-7 items-center justify-center border border-border-strong bg-surface/70 text-text-secondary backdrop-blur hover:text-text-primary disabled:opacity-30"
                  aria-label="Move later"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddPhotosDialog({
  userId,
  onAdd,
  saving,
  existing,
}: {
  userId: number
  onAdd: (ids: number[]) => void
  saving: boolean
  existing: CuratedPhoto[]
}) {
  const [open, setOpen] = useState(false)
  const [albums, setAlbums] = useState<Album[]>([])
  const [slug, setSlug] = useState<string>("")
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (open) apiFetch<Album[]>(`/albums/?user_id=${userId}`).then(setAlbums).catch(() => {})
  }, [open, userId])

  useEffect(() => {
    if (!slug) return
    setLoadingPhotos(true)
    setPicked(new Set())
    apiFetch<Album>(`/album/${slug}/`)
      .then((a) => setAlbumPhotos(a.album_photos ?? []))
      .catch(() => setAlbumPhotos([]))
      .finally(() => setLoadingPhotos(false))
  }, [slug])

  const existingIds = new Set(existing.map((e) => e.photo_id))
  // file_metadata in the album view doesn't carry its own id; match by filename
  // against what's already curated is unreliable, so we rely on the backend to
  // skip dupes — here we just collect the picked photo ids.
  const toggle = (pid: number) => {
    setPicked((s) => {
      const n = new Set(s)
      n.has(pid) ? n.delete(pid) : n.add(pid)
      return n
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className={brandButton} />}>
        <Plus className="size-3.5" />
        Add photos
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add photos to this category</DialogTitle>
          <DialogDescription>
            Pick photos from any album. They stay in their original album — this just
            references them on the site.
          </DialogDescription>
        </DialogHeader>

        <Select value={slug} onValueChange={(v) => setSlug(v ?? "")}>
          <SelectTrigger className="h-10 bg-surface">
            <SelectValue placeholder="Choose an album" />
          </SelectTrigger>
          <SelectContent>
            {albums.map((a) => (
              <SelectItem key={a.slug} value={a.slug}>
                {a.album_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="max-h-[50vh] overflow-y-auto">
          {loadingPhotos ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : albumPhotos.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              {slug ? "No photos in this album." : "Choose an album to see its photos."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {albumPhotos.map((ph) => {
                const pid = ph.file_metadata.id ?? -1
                const isExisting = existingIds.has(pid)
                const isPicked = picked.has(pid)
                return (
                  <button
                    key={ph.file_metadata.filename}
                    onClick={() => !isExisting && pid > 0 && toggle(pid)}
                    disabled={isExisting || pid <= 0}
                    className={`relative aspect-square overflow-hidden border bg-surface-elevated transition-all ${
                      isExisting
                        ? "border-border-subtle opacity-40"
                        : isPicked
                          ? "border-brand"
                          : "border-border-subtle hover:border-border-strong"
                    }`}
                  >
                    <Image
                      src={ph.compressed_image}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                    {isPicked && <span className="absolute inset-0 bg-brand/25" />}
                    {isExisting && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-[0.15em] text-text-primary">
                        Added
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => {
              onAdd([...picked])
              setOpen(false)
            }}
            disabled={saving || picked.size === 0}
            className={brandButton}
          >
            {saving ? "Adding…" : `Add ${picked.size || ""}`.trim()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
