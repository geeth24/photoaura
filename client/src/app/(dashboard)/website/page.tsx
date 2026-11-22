"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, ImageIcon, Plus, Tags, Trash2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Album, Category, Photo } from "@/lib/types"
import { plural } from "@/lib/format"
import { brandButton, PageHeader, quietButton } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlbumOptions } from "@/components/album-options"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

// what /category-albums returns: the photos the site shows for each category
type SiteRow = {
  category_id: number
  album: { id: number; name: string; slug: string; image_count: number; album_photos: Photo[] }
}
type Live = { photos: Photo[]; curated: number; album: Album | null }

const SITE_GALLERY = "https://reactiveshots.com/gallery"
const STRIP = 7

export default function WebsitePage() {
  useDocumentTitle("Website")
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [live, setLive] = useState<Record<number, Live>>({})
  const [catName, setCatName] = useState("")
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    if (!user) return
    try {
      const [cats, all, rows] = await Promise.all([
        apiFetch<Category[]>("/categories"),
        apiFetch<Album[]>(`/albums/?user_id=${user.id}&include_website=true`),
        apiFetch<SiteRow[]>("/category-albums"),
      ])
      const curated = await Promise.all(
        cats.map((c) => apiFetch<unknown[]>(`/categories/${c.id}/photos`).then((p) => p.length).catch(() => 0)),
      )
      const next: Record<number, Live> = {}
      cats.forEach((c, i) => {
        const row = rows.find((r) => r.category_id === c.id)
        // a curated-only category comes back with a stand-in album named after itself
        const album = row ? (all.find((a) => a.album_id === row.album.id && a.slug === row.album.slug) ?? null) : null
        next[c.id] = { photos: row?.album.album_photos ?? [], curated: curated[i], album }
      })
      setCategories(cats)
      setAlbums(all)
      setLive(next)
    } catch {
      setCategories([])
    }
  }, [user])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const run = async (id: number | null, work: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(id)
    try {
      await work()
      toast.success(done)
      await fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failed)
    } finally {
      setBusy(null)
    }
  }

  const createCategory = async () => {
    if (!catName.trim()) return
    setCreating(true)
    await run(null, () => apiFetch(`/categories?name=${encodeURIComponent(catName.trim())}`, { method: "POST" }), "Category created", "Failed to create category")
    setCatName("")
    setCreating(false)
  }

  const link = (catId: number, albumId: number | undefined, method: "POST" | "DELETE") =>
    apiFetch(`/album-categories?album_id=${albumId}&category_id=${catId}`, { method })

  // swapping the featured album unlinks the old one first
  const feature = (catId: number, albumId: number) => {
    const current = live[catId]?.album
    if (current?.album_id === albumId) return
    run(
      catId,
      async () => {
        if (current) await link(catId, current.album_id, "DELETE")
        await link(catId, albumId, "POST")
      },
      "Featured album updated",
      "Failed to update album",
    )
  }

  const liveCount = categories?.filter((c) => (live[c.id]?.photos.length ?? 0) > 0).length ?? 0

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="reactiveshots.com"
        title="Website"
        subtitle={
          categories
            ? `What each category shows on the public gallery, newest work first. ${liveCount} of ${plural(categories.length, "category", "categories")} live.`
            : "Loading the public gallery…"
        }
        actions={
          <a href={SITE_GALLERY} target="_blank" rel="noopener noreferrer" className={quietButton}>
            View gallery
            <ArrowUpRight className="size-3.5" />
          </a>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createCategory()
        }}
        className="flex max-w-md items-center gap-2"
      >
        <input
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
          placeholder="New category, like Maternity"
          className="h-10 min-w-0 flex-1 border border-border-default bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-border-strong focus:outline-none"
        />
        <button type="submit" disabled={creating || !catName.trim()} className={brandButton}>
          <Plus className="size-3.5" />
          {creating ? "Adding…" : "Add"}
        </button>
      </form>

      {categories == null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <Tags className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-lg text-text-primary">No categories yet</p>
          <p className="mt-1 text-sm font-light text-text-muted">Add one above to start the public gallery.</p>
        </div>
      ) : (
        <ol className="divide-y divide-border-subtle border-y border-border-subtle">
          {categories.map((c, i) => (
            <CategoryRow
              key={c.id}
              index={i}
              category={c}
              live={live[c.id]}
              albums={albums}
              busy={busy === c.id}
              onFeature={(albumId) => feature(c.id, albumId)}
              onUnlink={() => run(c.id, () => link(c.id, live[c.id]?.album?.album_id, "DELETE"), "Album unlinked", "Failed to unlink album")}
              onDelete={() => run(c.id, () => apiFetch(`/categories/${c.id}`, { method: "DELETE" }), "Category deleted", "Failed to delete category")}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function CategoryRow({
  index,
  category: c,
  live,
  albums,
  busy,
  onFeature,
  onUnlink,
  onDelete,
}: {
  index: number
  category: Category
  live?: Live
  albums: Album[]
  busy: boolean
  onFeature: (albumId: number) => void
  onUnlink: () => void
  onDelete: () => void
}) {
  const photos = live?.photos ?? []
  const album = live?.album ?? null
  const status = live?.curated
    ? { label: `Curated · ${plural(live.curated, "photo")}`, tone: "border-brand/60 text-brand" }
    : album
      ? { label: "Whole album", tone: "border-border-default text-text-secondary" }
      : { label: "Not on the site", tone: "border-dashed border-warning/60 text-warning" }

  return (
    <li className="grid gap-6 py-7 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div className="space-y-4">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-brand/70">{String(index + 1).padStart(2, "0")}</span>
          <h2 className="mt-1 font-heading text-2xl leading-tight tracking-tight text-text-primary">{c.name}</h2>
          <a
            href={`${SITE_GALLERY}/${c.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-faint transition-colors hover:text-brand"
          >
            /gallery/{c.slug}
            <ArrowUpRight className="size-3" />
          </a>
        </div>
        <span className={cn("inline-block border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.2em]", status.tone)}>{status.label}</span>
        <div className="flex items-center gap-2">
          <Link href={`/website/${c.id}`} className={cn(quietButton, "h-9 px-3")}>
            <ImageIcon className="size-3.5" />
            Curate
          </Link>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <button aria-label={`Delete ${c.name}`} className="flex size-9 items-center justify-center text-text-faint transition-colors hover:text-destructive" />
              }
            >
              <Trash2 className="size-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {c.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  It disappears from the public gallery and its album link is removed. Your albums and photos stay.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {photos.length ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {photos.slice(0, STRIP).map((p) => (
              <div key={`${p.file_metadata.album_id}-${p.file_metadata.filename}`} className="relative h-36 shrink-0 overflow-hidden bg-surface-elevated sm:h-44" style={{ aspectRatio: `${p.file_metadata.width || 4} / ${p.file_metadata.height || 5}` }}>
                <Image src={p.compressed_image} alt="" fill className="object-cover" sizes="240px" />
              </div>
            ))}
            {photos.length > STRIP && (
              <Link
                href={`/website/${c.id}`}
                className="flex h-36 w-24 shrink-0 flex-col items-center justify-center border border-border-subtle text-text-muted transition-colors hover:border-brand hover:text-brand sm:h-44"
              >
                <span className="font-heading text-2xl">+{photos.length - STRIP}</span>
                <span className="text-[9px] uppercase tracking-[0.2em]">more</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex h-36 flex-col items-center justify-center border border-dashed border-border-default px-6 text-center sm:h-44">
            <p className="font-heading text-lg text-text-primary">Nothing shows here yet</p>
            <p className="mt-1 text-sm font-light text-text-muted">Feature an album below, or curate photos from any album.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-faint">
            {live?.curated ? "Fallback album" : "Featured album"}
          </span>
          <Select value={album ? String(album.album_id) : ""} onValueChange={(v) => onFeature(Number(v))} disabled={busy}>
            <SelectTrigger className="h-9 min-w-56 flex-1 bg-surface-elevated text-[12px] sm:max-w-xs sm:flex-none">
              <SelectValue placeholder="Choose an album">
                {(v) => albums.find((a) => String(a.album_id) === String(v))?.album_name ?? "Choose an album"}
              </SelectValue>
            </SelectTrigger>
            <AlbumOptions albums={albums} />
          </Select>
          {album && (
            <button
              onClick={onUnlink}
              disabled={busy}
              aria-label="Unlink album"
              className="flex size-9 items-center justify-center border border-border-default text-text-muted transition-colors hover:border-border-strong hover:text-destructive disabled:opacity-50"
            >
              <Unlink className="size-3.5" />
            </button>
          )}
          {live?.curated && album ? (
            <span className="text-[11px] font-light text-text-faint">Shown only if you clear the curated picks</span>
          ) : null}
        </div>
      </div>
    </li>
  )
}
