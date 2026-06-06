"use client"

import { useState } from "react"
import cdnImageLoader from "@/lib/cdn-image-loader"
import { isVideo, type Photo } from "@/lib/types"
import { hasSeenImage, markImageSeen } from "@/lib/image-cache"

// direction-aware slide (nextjsconf gallery flow)
export const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 420 : -420, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 420 : -420, opacity: 0 }),
}

// one fixed width the upload warmer pre-generates -> CloudFront cache hit
export const FULL_WIDTH = 2048

// width/height attrs reserve the aspect box before load, so the blur background
// fills it instantly (no empty frame); the warmed full-res fades in on decode.
export function LightboxImage({ photo }: { photo: Photo }) {
  const m = photo.file_metadata
  const src = !isVideo(photo) ? cdnImageLoader({ src: photo.image, width: FULL_WIDTH }) : ""
  // seen before -> the full-res is browser-cached, show it instantly (no fade)
  const [loaded, setLoaded] = useState(() => hasSeenImage(src))

  if (isVideo(photo)) {
    return (
      <video
        src={photo.image}
        controls
        autoPlay
        playsInline
        className="max-h-[82vh] max-w-[92vw] bg-black"
      />
    )
  }

  return (
    <div
      className="relative overflow-hidden bg-white/5"
      style={
        m.blur_data_url && !loaded
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
        onLoad={() => {
          setLoaded(true)
          markImageSeen(src)
        }}
        className={`block h-auto max-h-[82vh] w-auto max-w-[92vw] object-contain transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}
