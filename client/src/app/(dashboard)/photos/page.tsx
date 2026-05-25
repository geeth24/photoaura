"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Photo } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { PhotoMasonry } from "@/components/photo-masonry"
import { LibraryLightbox } from "@/components/library-lightbox"
import { ImageOff } from "lucide-react"

type OrientationFilter = "all" | "portrait" | "landscape"

export default function PhotosPage() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [orientation, setOrientation] = useState<OrientationFilter>("all")
  const [viewer, setViewer] = useState<number | null>(null)

  const fetchPhotos = useCallback(() => {
    if (!user) return
    const params = orientation === "all" ? "" : `&orientation=${orientation}`
    apiFetch<Photo[]>(`/photos/?user_id=${user.id}${params}`)
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [user, orientation])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const filters: { label: string; value: OrientationFilter }[] = [
    { label: "All", value: "all" },
    { label: "Portrait", value: "portrait" },
    { label: "Landscape", value: "landscape" },
  ]

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
            Photos
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            {loading
              ? "Loading photos…"
              : `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
          </p>
        </div>

        {/* orientation segmented control */}
        <div className="flex border border-border-default">
          {filters.map((f, i) => {
            const active = orientation === f.value
            return (
              <button
                key={f.value}
                onClick={() => setOrientation(f.value)}
                className={`h-9 px-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors ${
                  i > 0 ? "border-l border-border-default" : ""
                } ${
                  active
                    ? "bg-surface-hover text-brand"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[260px] grow"
              style={{ flexBasis: `${220 + (i % 3) * 90}px` }}
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
          <ImageOff className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">No photos yet</p>
          <p className="mt-1 text-sm font-light text-text-muted">
            Upload photos to your albums to see them here.
          </p>
        </div>
      ) : (
        <PhotoMasonry photos={photos} onOpen={(i) => setViewer(i)} />
      )}

      {viewer !== null && (
        <LibraryLightbox
          photos={photos}
          start={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  )
}
