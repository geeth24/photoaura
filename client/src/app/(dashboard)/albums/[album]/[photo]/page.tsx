"use client"

import { use } from "react"
import { AlbumView } from "../album-view"

// a shared or refreshed photo link: the album, with that photo already open
export default function AlbumPhotoPage({
  params,
}: {
  params: Promise<{ album: string; photo: string }>
}) {
  const { album, photo } = use(params)
  return <AlbumView albumSlug={album} initialPhoto={decodeURIComponent(photo)} />
}
