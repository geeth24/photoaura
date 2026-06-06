"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import { Trash2, Play } from "lucide-react"
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
import { isVideo, type Photo } from "@/lib/types"
import { hasSeenImage, markImageSeen } from "@/lib/image-cache"

type Props = {
  photos: Photo[]
  // album mode: tiles link into the album's lightbox route
  albumSlug?: string
  selectedFace?: string | null
  onDelete?: (filename: string) => void
  // library mode: tiles call back with the clicked index instead of linking
  onOpen?: (index: number) => void
}

const GAP = 8

type Tile = { photo: Photo; w: number; h: number }

// justified rows: each row fills the container width at a shared height, with
// every photo at its true aspect ratio (computed from stored width/height, so
// no image measuring). a few photos make one clean row; many wrap naturally.
function buildRows(photos: Photo[], width: number, targetH: number): Tile[][] {
  if (!width) return []
  const ratio = (p: Photo) =>
    (p.file_metadata.width || 3) / (p.file_metadata.height || 2)

  const rows: Tile[][] = []
  let row: Photo[] = []
  let ratioSum = 0

  for (const p of photos) {
    row.push(p)
    ratioSum += ratio(p)
    const rowW = ratioSum * targetH + (row.length - 1) * GAP
    if (rowW >= width) {
      const h = (width - (row.length - 1) * GAP) / ratioSum
      rows.push(row.map((ph) => ({ photo: ph, w: ratio(ph) * h, h })))
      row = []
      ratioSum = 0
    }
  }
  // last partial row keeps natural height (left-aligned), don't stretch it wide
  if (row.length) {
    rows.push(row.map((ph) => ({ photo: ph, w: ratio(ph) * targetH, h: targetH })))
  }
  return rows
}

export function PhotoMasonry({
  photos,
  albumSlug,
  selectedFace,
  onDelete,
  onOpen,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth))
    ro.observe(el)
    setWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  const targetH = width < 640 ? 200 : width < 1024 ? 260 : 320
  const rows = buildRows(photos, width, targetH)
  let n = 0

  return (
    <div ref={ref} className="flex flex-col" style={{ gap: GAP }}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: GAP }}>
          {row.map(({ photo, w, h }) => {
            const i = n++
            const m = photo.file_metadata
            const video = isVideo(photo)
            const media = video ? (
              <>
                <video
                  src={photo.image}
                  preload="metadata"
                  muted
                  playsInline
                  className="size-full object-cover"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                    <Play className="size-4" />
                  </span>
                </span>
              </>
            ) : (
              <Image
                src={photo.compressed_image}
                alt={m.description || m.filename}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 40vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                // already loaded once -> skip the blur, it's in the browser cache
                placeholder={
                  m.blur_data_url && !hasSeenImage(photo.compressed_image)
                    ? "blur"
                    : "empty"
                }
                blurDataURL={m.blur_data_url || undefined}
                onLoad={() => markImageSeen(photo.compressed_image)}
              />
            )
            return (
              <motion.div
                key={`${m.album_id}-${m.filename}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(i * 0.015, 0.25),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group relative shrink-0"
                style={{ width: w, height: h }}
              >
                {onOpen ? (
                  <button
                    onClick={() => onOpen(i)}
                    className="relative block size-full cursor-zoom-in overflow-hidden border border-border-subtle bg-surface-elevated"
                  >
                    {media}
                  </button>
                ) : (
                  <Link
                    href={`/albums/${albumSlug}/${encodeURIComponent(m.filename)}${
                      selectedFace ? `?face=${selectedFace}` : ""
                    }`}
                    className="relative block size-full cursor-zoom-in overflow-hidden border border-border-subtle bg-surface-elevated"
                    scroll={false}
                  >
                    {media}
                  </Link>
                )}
                {onDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <button
                          className="absolute right-2 top-2 border border-border-strong bg-surface/70 p-1.5 text-text-secondary opacity-0 backdrop-blur transition-all hover:text-destructive group-hover:opacity-100"
                          aria-label="Delete photo"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete photo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes this photo from the album.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => onDelete(m.filename)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </motion.div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
