"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence, MotionConfig } from "motion/react"
import cdnImageLoader from "@/lib/cdn-image-loader"
import { LightboxImage, slide, FULL_WIDTH } from "@/components/lightbox-image"
import { DownloadMenu } from "@/components/download-menu"
import { PhotoInfoPanel } from "@/components/photo-info-panel"
import type { Photo } from "@/lib/types"
import { X, ChevronLeft, ChevronRight, Info } from "lucide-react"

type Props = {
  photos: Photo[]
  start: number
  onClose: () => void
}

// in-page lightbox over an already-loaded photos array (no routing / fetch).
export function LibraryLightbox({ photos, start, onClose }: Props) {
  const [index, setIndex] = useState(start)
  const [direction, setDirection] = useState(0)
  const [showInfo, setShowInfo] = useState(false)

  const goto = useCallback(
    (i: number) => {
      if (i < 0 || i >= photos.length) return
      setDirection(i > index ? 1 : -1)
      setIndex(i)
    },
    [index, photos.length]
  )

  const hasPrev = index > 0
  const hasNext = index < photos.length - 1
  const current = photos[index]

  // keyboard nav + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") showInfo ? setShowInfo(false) : onClose()
      else if (e.key === "ArrowLeft") goto(index - 1)
      else if (e.key === "ArrowRight") goto(index + 1)
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, goto, index, showInfo])

  // predictive prefetch: warm a window of full-res in the direction of travel
  // so the next few land instantly, plus one the other way
  useEffect(() => {
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
  }, [index, photos, direction])

  if (!current) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4 text-white/90">
        <span className="text-sm text-white/60">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-1">
          {current && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowInfo((v) => !v)
              }}
              className={`rounded-full p-2 transition-colors hover:bg-white/10 ${showInfo ? "text-brand" : ""}`}
              aria-label="Photo info"
            >
              <Info className="size-5" />
            </button>
          )}
          {current && <DownloadMenu photo={current} />}
          <button
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden px-4 pb-4">
        <MotionConfig
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
        >
          <AnimatePresence initial={false} custom={direction}>
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

      {current && (
        <PhotoInfoPanel photo={current} open={showInfo} onOpenChange={setShowInfo} />
      )}
    </motion.div>
  )
}
