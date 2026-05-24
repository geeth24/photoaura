"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { PhotoLightbox } from "@/components/photo-lightbox"

export default function PhotoPage({
  params,
}: {
  params: Promise<{ user: string; album: string; photo: string }>
}) {
  const { user, album, photo } = use(params)
  const router = useRouter()
  return (
    <PhotoLightbox
      user={user}
      album={album}
      photo={decodeURIComponent(photo)}
      onClose={() => router.push(`/albums/${user}/${album}`)}
    />
  )
}
