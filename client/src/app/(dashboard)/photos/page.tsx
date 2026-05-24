"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/context/auth-context"
import { apiFetch, apiStream } from "@/lib/api"
import type { Photo } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Sparkles } from "lucide-react"
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={orientation === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setOrientation(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleLabelPhotos}
            disabled={labeling}
          >
            <Sparkles className="size-3.5" />
            {labeling ? "Labeling..." : "AI Label"}
          </Button>
        </div>
      </div>

      {labeling && labelTotal > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Labeling photos</span>
            <span>{labelProgress}/{labelTotal}</span>
          </div>
          <Progress value={(labelProgress / labelTotal) * 100} />
        </div>
      )}

      {loading ? (
        <div className="columns-2 gap-4 space-y-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="w-full break-inside-avoid"
              style={{ aspectRatio: i % 2 === 0 ? "3/4" : "4/3" }}
            />
          ))}
        </div>
      ) : (
        <div className="columns-2 gap-4 space-y-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {photos.map((photo) => {
            const { width, height } = photo.file_metadata
            return (
              <div
                key={photo.compressed_image}
                className="group relative break-inside-avoid overflow-hidden"
              >
                <Image
                  src={photo.compressed_image}
                  alt={photo.file_metadata.description || photo.file_metadata.filename}
                  width={width}
                  height={height}
                  className="w-full"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
                {photo.file_metadata.description && (
                  <div className="absolute inset-x-0 bottom-0 translate-y-full bg-background/80 p-2 text-xs text-foreground backdrop-blur-sm transition-transform group-hover:translate-y-0">
                    {photo.file_metadata.description}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p>No photos found</p>
        </div>
      )}
    </div>
  )
}
