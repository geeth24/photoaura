"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence, MotionConfig } from "motion/react"
import { apiFetch } from "@/lib/api"
import cdnImageLoader from "@/lib/cdn-image-loader"
import { LightboxImage, slide, FULL_WIDTH } from "@/components/lightbox-image"
import { PhotoInfoPanel } from "@/components/photo-info-panel"
import { DownloadMenu } from "@/components/download-menu"
import { isVideo, type Album, type AlbumFace, type Photo } from "@/lib/types"
import { X, ChevronLeft, ChevronRight, Info } from "lucide-react"

type Props = {
  slug: string
  photo: string // initial filename
  onClose: () => void
}

export function PhotoLightbox({ slug, photo, onClose }: Props) {
  const searchParams = useSearchParams()
  const faceId = searchParams.get("face")

  const [allPhotos, setAllPhotos] = useState<Photo[] | null>(null)
  const [faceFilenames, setFaceFilenames] = useState<Set<string> | null>(null)
  const [index, setIndex] = useState(-1)
  const [direction, setDirection] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)
  // the photo the modal opened on — captured once, used to pick the start index
  const [initialPhoto] = useState(photo)

  useEffect(() => {
    apiFetch<Album>(`/album/${slug}/`)
      .then((a) => setAllPhotos(a.album_photos))
      .catch(() => setAllPhotos([]))
  }, [slug])

  // opened from a person filter -> scope navigation to that person's photos
  useEffect(() => {
    if (!faceId) return
    apiFetch<AlbumFace[]>(`/album/${slug}/faces`)
      .then((faces) => {
        const f = faces.find((x) => x.face_id === faceId)
        setFaceFilenames(new Set(f?.filenames ?? []))
      })
      .catch(() => setFaceFilenames(new Set()))
  }, [slug, faceId])

  // a video plays on its own — it doesn't belong in the photo swipe/filmstrip
  const openedItem = useMemo(
    () => allPhotos?.find((p) => p.file_metadata.filename === initialPhoto) ?? null,
    [allPhotos, initialPhoto]
  )
  const openedIsVideo = !!openedItem && isVideo(openedItem)

  const photos = useMemo(() => {
    if (!allPhotos) return null
    if (faceId && !faceFilenames) return null // wait for the filter to load
    const scoped = faceFilenames
      ? allPhotos.filter((p) => faceFilenames.has(p.file_metadata.filename))
      : allPhotos
    return scoped.filter((p) => !isVideo(p))
  }, [allPhotos, faceId, faceFilenames])

  // pick the starting photo once the (possibly filtered) set is ready
  if (!openedIsVideo && photos && index === -1) {
    const i = photos.findIndex((p) => p.file_metadata.filename === initialPhoto)
    setIndex(i >= 0 ? i : 0)
  }

  const current = openedIsVideo
    ? openedItem
    : photos && index >= 0
      ? photos[index]
      : null
  const hasPrev = !openedIsVideo && index > 0
  const hasNext =
    !openedIsVideo && photos != null && index >= 0 && index < photos.length - 1

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
        `/albums/${slug}/${encodeURIComponent(name)}${faceId ? `?face=${faceId}` : ""}`
      )
    },
    [photos, index, slug, faceId]
  )

  // hide immediately on close, then sync the URL. in-lightbox next/prev rewrites
  // the URL via replaceState, which can leave router.push unable to dismiss the
  // intercepted modal — local state guarantees it actually closes.
  const handleClose = useCallback(() => {
    setDismissed(true)
    // the modal often stays mounted (router.push no-ops after our replaceState),
    // so the scroll-lock effect's cleanup never runs — release it here or the
    // page can't scroll after closing.
    document.body.style.overflow = ""
    // correct the address bar directly so a refresh shows the album, not the photo
    window.history.replaceState(null, "", `/albums/${slug}`)
    onClose()
  }, [onClose, slug])

  // keyboard nav + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape closes the info panel first, then the lightbox
      if (e.key === "Escape") showInfo ? setShowInfo(false) : handleClose()
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
  }, [handleClose, goto, index, hasPrev, hasNext, showInfo])

  // keep the active thumbnail in view
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [index])

  // predictive prefetch: warm a window of full-res images in the direction of
  // travel (like Google Photos) so the next few land instantly, plus one the
  // other way. on first open (direction 0) we warm both immediate neighbours.
  useEffect(() => {
    if (!photos || index < 0) return
    const dir = direction === 0 ? 1 : direction
    const targets =
      direction === 0
        ? [index + 1, index - 1]
        : [index + dir, index + dir * 2, index + dir * 3, index - dir]
    const seen = new Set<number>()
    for (const i of targets) {
      if (i < 0 || i >= photos.length || seen.has(i)) continue
      seen.add(i)
      const img = new window.Image()
      img.src = cdnImageLoader({ src: photos[i].image, width: FULL_WIDTH })
    }
  }, [photos, index, direction])

  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={handleClose}
    >
      {/* top bar */}
      <div className="flex items-center justify-between p-4 text-white/90">
        <span className="text-sm text-white/60">
          {index >= 0 && photos ? `${index + 1} / ${photos.length}` : ""}
        </span>
        <div className="flex items-center gap-1">
          {current && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowInfo((v) => !v)
              }}
              className={`rounded-full p-2 transition-colors hover:bg-white/10 ${
                showInfo ? "text-brand" : ""
              }`}
              aria-label="Photo info"
            >
              <Info className="size-5" />
            </button>
          )}
          {current && <DownloadMenu photo={current} slug={slug} />}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            className="rounded-full p-2 transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
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

      {/* thumbnail filmstrip — photos only, hidden when viewing a standalone video */}
      {!openedIsVideo && photos && photos.length > 1 && (
        <div
          ref={stripRef}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

      {/* metadata / EXIF panel */}
      {current && (
        <PhotoInfoPanel photo={current} open={showInfo} onOpenChange={setShowInfo} />
      )}
    </motion.div>
  )
}
