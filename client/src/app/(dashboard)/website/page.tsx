"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Album, Category, Photo } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, Trash2, Unlink, Tags, ImageOff, ExternalLink, Star, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"

// the featured album shape returned by /category-albums (note: `name`, `id`)
type FeaturedAlbum = {
  id: number
  name: string
  slug: string
  image_count: number
  album_photos: Photo[]
}
type CategoryAlbumRow = {
  category_id: number
  category_name: string
  category_slug: string
  album: FeaturedAlbum
}

const SITE_GALLERY = "https://reactiveshots.com/gallery"

export default function WebsitePage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [featured, setFeatured] = useState<Record<number, FeaturedAlbum>>({})
  const [loading, setLoading] = useState(true)

  const [catName, setCatName] = useState("")
  const [catCreating, setCatCreating] = useState(false)
  const [busyCat, setBusyCat] = useState<number | null>(null)

  const fetchAll = () => {
    if (!user) return
    setLoading(true)
    Promise.all([
      apiFetch<Category[]>("/categories"),
      apiFetch<Album[]>(`/albums/?user_id=${user.id}`),
      apiFetch<CategoryAlbumRow[]>("/category-albums"),
    ])
      .then(([c, a, rows]) => {
        setCategories(c)
        setAlbums(a)
        const map: Record<number, FeaturedAlbum> = {}
        rows.forEach((r) => {
          map[r.category_id] = r.album
        })
        setFeatured(map)
      })
      .catch(() => {
        setCategories([])
        setAlbums([])
        setFeatured({})
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const createCategory = async () => {
    if (!catName.trim()) return
    setCatCreating(true)
    try {
      await apiFetch(`/categories?name=${encodeURIComponent(catName)}`, { method: "POST" })
      toast.success("Category created")
      setCatName("")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create category")
    } finally {
      setCatCreating(false)
    }
  }

  const deleteCategory = async (id: number) => {
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" })
      toast.success("Category deleted")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete category")
    }
  }

  // set (or change) the featured album for a category; unlinks the previous one first
  const setCategoryAlbum = async (categoryId: number, albumId: number) => {
    const current = featured[categoryId]
    if (current?.id === albumId) return
    setBusyCat(categoryId)
    try {
      if (current) {
        await apiFetch(
          `/album-categories?album_id=${current.id}&category_id=${categoryId}`,
          { method: "DELETE" }
        )
      }
      await apiFetch(
        `/album-categories?album_id=${albumId}&category_id=${categoryId}`,
        { method: "POST" }
      )
      toast.success("Featured album updated")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update album")
    } finally {
      setBusyCat(null)
    }
  }

  const unlinkAlbum = async (categoryId: number) => {
    const current = featured[categoryId]
    if (!current) return
    setBusyCat(categoryId)
    try {
      await apiFetch(
        `/album-categories?album_id=${current.id}&category_id=${categoryId}`,
        { method: "DELETE" }
      )
      toast.success("Album unlinked")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unlink album")
    } finally {
      setBusyCat(null)
    }
  }

  const linkedCount = Object.keys(featured).length

  return (
    <div className="space-y-12">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Public Site
          </span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          Website
        </h1>
        <p className="mt-3 text-sm font-light text-text-secondary">
          Each category shows one featured album on your public gallery.
        </p>
      </motion.div>

      {/* create category */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <label className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
            New Category
          </label>
          <Input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createCategory()}
            placeholder="Category name"
            className="h-11 w-64 bg-surface-elevated"
          />
        </div>
        <button
          onClick={createCategory}
          disabled={catCreating}
          className="flex h-11 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          {catCreating ? "Creating…" : "Create"}
        </button>
      </div>

      {/* categories */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <span className="block h-px w-8 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Categories
          </span>
          {!loading && categories.length > 0 && (
            <span className="text-[10px] uppercase tracking-[0.3em] text-text-faint">
              {linkedCount}/{categories.length} linked
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
            <Tags className="size-6 text-text-faint" />
            <p className="mt-3 font-heading text-lg text-text-primary">No categories yet</p>
            <p className="mt-1 text-sm font-light text-text-muted">
              Create one above to group albums on your site.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat, i) => {
              const album = featured[cat.id]
              const cover = album?.album_photos?.[0]?.compressed_image
              const busy = busyCat === cat.id
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: Math.min(i * 0.05, 0.4),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group flex flex-col border border-border-subtle bg-surface-elevated"
                >
                  {/* cover */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-surface">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={album.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-text-faint">
                        <ImageOff className="size-6" />
                        <span className="text-[10px] uppercase tracking-[0.25em]">
                          Not linked
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/15 to-transparent" />

                    {/* delete category */}
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <button
                            className="absolute right-3 top-3 flex size-8 items-center justify-center bg-surface/70 text-text-faint opacity-0 backdrop-blur transition-all hover:text-destructive group-hover:opacity-100"
                            aria-label={`Delete ${cat.name}`}
                          />
                        }
                      >
                        <Trash2 className="size-4" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes &quot;{cat.name}&quot; and its album link.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => deleteCategory(cat.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* name */}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 font-heading text-xl leading-tight tracking-tight text-text-primary">
                          {cat.name}
                        </h3>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
                          /{cat.slug}
                        </p>
                      </div>
                      <a
                        href={`${SITE_GALLERY}/${cat.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-text-muted transition-colors hover:text-brand"
                        aria-label="View on site"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* featured album + controls */}
                  <div className="space-y-3 p-4">
                    <Link
                      href={`/website/${cat.id}`}
                      className="flex items-center justify-center gap-2 border border-border-default py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-brand hover:text-brand"
                    >
                      <ImageIcon className="size-3.5" />
                      Curate photos
                    </Link>
                    <p className="text-[10px] leading-relaxed text-text-faint">
                      Hand-pick photos from any album (no re-upload). Falls back to the
                      whole featured album below if none are picked.
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      {album ? (
                        <span className="flex min-w-0 items-center gap-1.5 text-sm text-text-secondary">
                          <Star className="size-3 shrink-0 fill-brand text-brand" />
                          <span className="truncate">{album.name}</span>
                        </span>
                      ) : (
                        <span className="text-sm font-light text-text-muted">
                          No featured album
                        </span>
                      )}
                      {album && (
                        <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
                          {album.image_count}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={album ? String(album.id) : ""}
                        onValueChange={(v) => setCategoryAlbum(cat.id, Number(v))}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-10 flex-1 bg-surface">
                          <SelectValue placeholder={album ? "Change album" : "Link an album"} />
                        </SelectTrigger>
                        <SelectContent>
                          {albums.map((a) => (
                            <SelectItem key={a.album_id} value={String(a.album_id)}>
                              {a.album_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {album && (
                        <button
                          onClick={() => unlinkAlbum(cat.id)}
                          disabled={busy}
                          className="flex size-10 shrink-0 items-center justify-center border border-border-default text-text-muted transition-colors hover:border-border-strong hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                          aria-label="Unlink album"
                        >
                          <Unlink className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
