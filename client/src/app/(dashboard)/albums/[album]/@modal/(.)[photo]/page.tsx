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
  return (
    <PhotoLightbox
      slug={album}
      photo={decodeURIComponent(photo)}
      onClose={() => router.back()}
    />
  )
}
