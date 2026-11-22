"use client"

import { useCallback, useMemo, useState } from "react"
import { isVideo, type Photo } from "@/lib/types"
import { PhotoViewer, VideoViewer } from "@/components/photo-viewer"

// tap a tile: stills swipe in the photo viewer, videos open on their own
export function usePhotoViewer(photos: Photo[]) {
  const [index, setIndex] = useState<number | null>(null)
  const [video, setVideo] = useState<Photo | null>(null)
  const stills = useMemo(() => photos.filter((p) => !isVideo(p)), [photos])
  const open = useCallback((p: Photo) => (isVideo(p) ? setVideo(p) : setIndex(stills.indexOf(p))), [stills])
  const viewers = (
    <>
      <PhotoViewer photos={stills} openIndex={index} onClose={() => setIndex(null)} />
      <VideoViewer photo={video} onClose={() => setVideo(null)} />
    </>
  )
  return { open, viewers }
}
