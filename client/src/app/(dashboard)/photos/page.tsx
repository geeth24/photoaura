"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/auth-context"
import { apiFetch, apiStream } from "@/lib/api"
import type { Photo } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, ImageOff } from "lucide-react"
import Image from "next/image"

type OrientationFilter = "all" | "portrait" | "landscape"

export default function PhotosPage() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [orientation, setOrientation] = useState<OrientationFilter>("all")
  const [labeling, setLabeling] = useState(false)
  const [labelProgress, setLabelProgress] = useState(0)
  const [labelTotal, setLabelTotal] = useState(0)

  const fetchPhotos = useCallback(() => {
    if (!user) return
    setLoading(true)
    const params = orientation === "all" ? "" : `&orientation=${orientation}`
    apiFetch<Photo[]>(`/photos/?user_id=${user.id}${params}`)
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [user, orientation])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const handleLabelPhotos = async () => {
    setLabeling(true)
    setLabelProgress(0)
    setLabelTotal(0)

    await apiStream("/label-photos", (data) => {
      if (data.total) setLabelTotal(data.total as number)
      if (data.progress) setLabelProgress(data.progress as number)
    })

    setLabeling(false)
    fetchPhotos()
  }

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
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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

        <button
          onClick={handleLabelPhotos}
          disabled={labeling}
          className="group flex h-9 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {labeling ? "Labeling..." : "AI Label"}
        </button>
      </div>

      {/* labeling progress */}
      {labeling && labelTotal > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-[11px] uppercase tracking-[0.2em] text-text-muted">
            <span>Labeling photos</span>
            <span>
              {labelProgress}/{labelTotal}
            </span>
          </div>
          <div className="h-px w-full bg-border-default">
            <div
              className="h-px bg-brand transition-all duration-300"
              style={{ width: `${(labelProgress / labelTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4 xl:columns-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="w-full break-inside-avoid"
              style={{ aspectRatio: i % 2 === 0 ? "3/4" : "4/3" }}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4 xl:columns-5"
        >
          {photos.map((photo) => {
            const { width, height } = photo.file_metadata
            return (
              <div
                key={photo.compressed_image}
                className="group relative break-inside-avoid overflow-hidden border border-border-subtle bg-surface-elevated"
              >
                <Image
                  src={photo.compressed_image}
                  alt={photo.file_metadata.description || photo.file_metadata.filename}
                  width={width}
                  height={height}
                  className="w-full transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  placeholder={photo.file_metadata.blur_data_url ? "blur" : "empty"}
                  blurDataURL={photo.file_metadata.blur_data_url || undefined}
                />
                {photo.file_metadata.description && (
                  <div className="absolute inset-x-0 bottom-0 translate-y-full border-t border-border-subtle bg-surface/85 p-3 text-xs leading-relaxed text-text-secondary backdrop-blur transition-transform duration-300 group-hover:translate-y-0">
                    {photo.file_metadata.description}
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
