"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence, MotionConfig } from "motion/react"
import { apiFetch } from "@/lib/api"
import cdnImageLoader from "@/lib/cdn-image-loader"
import type { Album, Photo } from "@/lib/types"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

type Props = {
  slug: string
  photo: string // initial filename
  onClose: () => void
}

// direction-aware slide (matches the nextjsconf gallery flow)
const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 420 : -420, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 420 : -420, opacity: 0 }),
}

// The width/height attrs reserve the aspect-correct box before load, so the
// blur background fills it instantly (no empty frame). The full-res is requested
// at a single fixed width (2048) the upload warmer pre-generates, so it's a
// CloudFront cache hit instead of a cold render. It fades in once decoded.
const FULL_WIDTH = 2048

function LightboxImage({ photo }: { photo: Photo }) {
  const [loaded, setLoaded] = useState(false)
  const m = photo.file_metadata
  const src = cdnImageLoader({ src: photo.image, width: FULL_WIDTH })
  return (
    <div
      className="relative overflow-hidden bg-white/5"
      style={
        m.blur_data_url
          ? {
              backgroundImage: `url("${m.blur_data_url}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={m.width || 1600}
        height={m.height || 1067}
        alt={m.description || m.filename}
        onLoad={() => setLoaded(true)}
        className={`block h-auto max-h-[82vh] w-auto max-w-[92vw] object-contain transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}

export function PhotoLightbox({ slug, photo, onClose }: Props) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [index, setIndex] = useState(-1)
  const [direction, setDirection] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  // the photo the modal opened on — captured once, used to pick the start index
  const [initialPhoto] = useState(photo)

  useEffect(() => {
    apiFetch<Album>(`/album/${slug}/`)
      .then((a) => {
        setPhotos(a.album_photos)
        const i = a.album_photos.findIndex(
          (p) => p.file_metadata.filename === initialPhoto
        )
        setIndex(i >= 0 ? i : 0)
      })
      .catch(() => {
        setPhotos([])
        setIndex(-1)
      })
  }, [slug, initialPhoto])

  const current = photos && index >= 0 ? photos[index] : null
  const hasPrev = index > 0
  const hasNext = photos != null && index >= 0 && index < photos.length - 1

  // navigate internally (no router push) so the slide animation isn't fighting a
  // route re-render; keep the URL in sync via the History API (no re-render).
  const goto = useCallback(
    (i: number) => {
      if (!photos || i < 0 || i >= photos.length) return
      setDirection(i > index ? 1 : -1)
      setIndex(i)
      const name = photos[i].file_metadata.filename
      window.history.replaceState(
        null,
        "",
        `/albums/${slug}/${encodeURIComponent(name)}`
      )
    },
    [photos, index, slug]
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

  // warm the full-res of the neighbors so arrow nav lands instantly
  useEffect(() => {
    if (!photos || index < 0) return
    for (const i of [index - 1, index + 1]) {
      if (i < 0 || i >= photos.length) continue
      const img = new window.Image()
      img.src = cdnImageLoader({ src: photos[i].image, width: FULL_WIDTH })
    }
  }, [photos, index])

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
      <div className="relative flex-1 overflow-hidden px-4 pb-2">
        <MotionConfig
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
        >
          <AnimatePresence initial={false} custom={direction}>
            {current && (
              <motion.div
                key={index}
                custom={direction}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0 flex items-center justify-center px-4"
                onClick={(e) => e.stopPropagation()}
              >
                <LightboxImage photo={current} />
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>

        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              goto(index - 1)
            }}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/90 transition-colors hover:bg-black/70"
            aria-label="Previous"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              goto(index + 1)
            }}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/90 transition-colors hover:bg-black/70"
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
