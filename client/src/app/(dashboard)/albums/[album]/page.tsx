"use client"

import { use } from "react"
import { AlbumView } from "./album-view"

export default function AlbumPage({ params }: { params: Promise<{ album: string }> }) {
  const { album } = use(params)
  return <AlbumView albumSlug={album} />
}
