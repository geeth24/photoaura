"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { PhotoLightbox } from "@/components/photo-lightbox"

export default function InterceptedPhotoModal({
  params,
}: {
  params: Promise<{ album: string; photo: string }>
}) {
  const { album, photo } = use(params)
  const router = useRouter()
  // navigate straight to the album, not router.back() — in-lightbox next/prev
  // rewrites the URL via history.replaceState, which desyncs back() and pops
  // it all the way to /albums instead of the album detail
  return (
    <PhotoLightbox
      slug={album}
      photo={decodeURIComponent(photo)}
      onClose={() => router.push(`/albums/${album}`)}
    />
  )
}
