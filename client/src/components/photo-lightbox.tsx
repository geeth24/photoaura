"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { apiFetch } from "@/lib/api"
import type { Album, Photo } from "@/lib/types"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

type Props = {
  user: string
  album: string
  photo: string // filename
  onClose: () => void
}

export function PhotoLightbox({ user, album, photo, onClose }: Props) {
  const router = useRouter()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch<Album>(`/album/${user}/${album}/`)
      .then((a) => setPhotos(a.album_photos))
      .catch(() => setPhotos([]))
  }, [user, album])

  const index = photos?.findIndex((p) => p.file_metadata.filename === photo) ?? -1
  const current = index >= 0 ? photos![index] : null
  const hasPrev = index > 0
  const hasNext = photos != null && index >= 0 && index < photos.length - 1

  const goto = useCallback(
    (i: number) => {
      if (!photos || i < 0 || i >= photos.length) return
      const name = photos[i].file_metadata.filename
      router.replace(`/albums/${user}/${album}/${encodeURIComponent(name)}`, {
        scroll: false,
      })
    },
    [photos, router, user, album]
  )

  // keyboard nav + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft" && hasPrev) goto(index - 1)
      else if (e.key === "ArrowRight" && hasNext) goto(index + 1)
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, goto, index, hasPrev, hasNext])

  // keep the active thumbnail in view
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [index])

  const meta = current?.file_metadata

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* top bar */}
      <div className="flex items-center justify-between p-4 text-white/90">
        <span className="text-sm text-white/60">
          {index >= 0 && photos ? `${index + 1} / ${photos.length}` : ""}
        </span>
        <button
          onClick={onClose}
          className="rounded-full p-2 transition-colors hover:bg-white/10"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* image + side nav */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-2">
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              goto(index - 1)
            }}
            className="absolute left-3 z-10 rounded-full bg-black/40 p-2 text-white/90 transition-colors hover:bg-black/70"
            aria-label="Previous"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {current && meta && (
            <motion.div
              key={meta.filename}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="relative flex h-full w-full items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={current.image}
                alt={meta.description || meta.filename}
                fill
                className="object-contain"
                sizes="100vw"
                placeholder={meta.blur_data_url ? "blur" : "empty"}
                blurDataURL={meta.blur_data_url || undefined}
                priority
              />
            </motion.div>
          )}
        </AnimatePresence>

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              goto(index + 1)
            }}
            className="absolute right-3 z-10 rounded-full bg-black/40 p-2 text-white/90 transition-colors hover:bg-black/70"
            aria-label="Next"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* thumbnail filmstrip */}
      {photos && photos.length > 1 && (
        <div
          ref={stripRef}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 overflow-x-auto px-4 pb-4"
        >
          <div className="mx-auto flex w-fit gap-2">
            {photos.map((p, i) => (
              <button
                key={p.file_metadata.filename}
                data-active={i === index}
                onClick={() => goto(i)}
                className={`relative size-14 shrink-0 overflow-hidden rounded-md outline-2 transition-all ${
                  i === index
                    ? "outline outline-white opacity-100"
                    : "outline-transparent opacity-50 hover:opacity-100"
                }`}
                aria-label={`Photo ${i + 1}`}
              >
                <Image
                  src={p.compressed_image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
