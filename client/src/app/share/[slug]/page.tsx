import type { Metadata } from "next"
import type { Photo } from "@/lib/types"
import { ShareGallery } from "./share-gallery"

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

type ShareAlbum = {
  album_name: string
  image_count: number
  album_photos: Photo[]
}

async function fetchAlbum(slug: string, secret: string): Promise<ShareAlbum | null> {
  const q = secret ? `?secret=${encodeURIComponent(secret)}` : ""
  try {
    const r = await fetch(`${API_URL}/album/${slug}/view${q}`, {
      next: { revalidate: 300 },
    })
    return r.ok ? ((await r.json()) as ShareAlbum) : null
  } catch {
    return null
  }
}

function pick(v: string | string[] | undefined): string {
  if (typeof v === "string") return v
  if (Array.isArray(v)) return v[0] ?? ""
  return ""
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>
}): Promise<Metadata> {
  const { slug } = await params
  const sp = await searchParams
  const secret = pick(sp.s) || pick(sp.secret)
  const album = await fetchAlbum(slug, secret)

  if (!album) return { title: "Shared Gallery · Reactive Shots" }

  // a non-video frame makes a stable OG image (presigned video URLs expire)
  const cover = album.album_photos?.find(
    (p) => !(p.file_metadata?.content_type || "").startsWith("video/")
  )
  const ogImage = cover?.image || cover?.compressed_image
  const count = album.album_photos?.length ?? album.image_count ?? 0
  const title = `${album.album_name} · Reactive Shots`
  const description = `${count} ${count === 1 ? "photo" : "photos"} — a shared gallery from Reactive Shots.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ShareGallery slug={slug} />
}
