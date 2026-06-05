"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Album } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
import { Plus, ArrowUpRight, ImageOff } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function AlbumsPage() {
  const { user } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlbums = useCallback(() => {
    if (!user) return
    // admins see every album in the studio (shared pool); clients only see
    // the albums shared with them
    const isAdmin = user.role !== "client"
    const path = isAdmin ? "/albums/" : `/albums/?user_id=${user.id}`
    apiFetch<Album[]>(path)
      .then(setAlbums)
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    fetchAlbums()
  }, [fetchAlbums])

  return (
    <div className="space-y-12">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Library
            </span>
          </div>
          <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
            Albums
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            {loading
              ? "Loading collections…"
              : `${albums.length} ${albums.length === 1 ? "collection" : "collections"}`}
          </p>
        </div>

        {user && (
          <UploadAlbumDialog
            mode="new"
            userId={user.id}
            onUploaded={fetchAlbums}
            trigger={
              <button className="group flex h-10 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)]">
                <Plus className="size-3.5" />
                New Album
              </button>
            }
          />
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
          <ImageOff className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">No albums yet</p>
          <p className="mt-1 text-sm font-light text-text-muted">
            Create your first collection to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album, i) => {
            const cover = album.album_photos?.[0]
            return (
              <motion.div
                key={album.slug}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
              >
                <Link href={`/albums/${album.slug}`} className="group block">
                  <div className="relative aspect-[4/3] w-full overflow-hidden border border-border-subtle bg-surface-elevated">
                    {cover ? (
                      <Image
                        src={cover.compressed_image}
                        alt={album.album_name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-text-faint">
                        <ImageOff className="size-6" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/15 to-transparent" />

                    <ArrowUpRight className="absolute right-4 top-4 size-4 -translate-y-1 text-brand opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" />

                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-brand/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="mt-1 line-clamp-1 font-heading text-xl leading-tight tracking-tight text-text-primary">
                        {album.album_name}
                      </h2>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-text-muted">
                        {album.image_count} {album.image_count === 1 ? "photo" : "photos"}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
