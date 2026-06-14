"use client"

import { Suspense, use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "motion/react"
import { PhotoMasonry } from "@/components/photo-masonry"
import { LibraryLightbox } from "@/components/library-lightbox"
import { Skeleton } from "@/components/ui/skeleton"
import type { Photo } from "@/lib/types"
import { ImageOff } from "lucide-react"

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

type ShareAlbum = {
  album_name: string
  image_count: number
  album_photos: Photo[]
}

// public, no-login gallery — anyone with the link can view the whole album
export default function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  return (
    <Suspense fallback={null}>
      <ShareGallery params={params} />
    </Suspense>
  )
}

function ShareGallery({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const sp = useSearchParams()
  const secret = sp.get("s") || sp.get("secret") || ""

  const [album, setAlbum] = useState<ShareAlbum | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    const q = secret ? `?secret=${encodeURIComponent(secret)}` : ""
    fetch(`${API_URL}/album/${slug}/${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setAlbum)
      .catch(() => setAlbum(null))
      .finally(() => setLoading(false))
  }, [slug, secret])

  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-10 lg:py-16">
        {/* brand */}
        <div className="mb-12 flex items-center justify-between">
          <a href="https://reactiveshots.com" target="_blank" rel="noopener noreferrer">
            <span className="font-blackmud text-3xl tracking-tight text-brand">
              Reactive Shots
            </span>
          </a>
          <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-faint">
            Shared Gallery
          </span>
        </div>

        {loading ? (
          <div className="space-y-8">
            <Skeleton className="h-12 w-72" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          </div>
        ) : !album ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
            <ImageOff className="size-6 text-text-faint" />
            <p className="mt-3 font-heading text-2xl text-text-primary">
              Gallery unavailable
            </p>
            <p className="mt-2 text-sm font-light text-text-muted">
              This link may be invalid or the gallery is no longer shared.
            </p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mb-10"
            >
              <div className="mb-4 flex items-center gap-4">
                <span className="block h-px w-12 bg-brand" />
                <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                  Gallery
                </span>
              </div>
              <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
                {album.album_name}
              </h1>
              <p className="mt-3 text-sm font-light text-text-secondary">
                {album.album_photos.length}{" "}
                {album.album_photos.length === 1 ? "photo" : "photos"}
              </p>
            </motion.div>

            <PhotoMasonry photos={album.album_photos} onOpen={setLightbox} />

            {lightbox !== null && (
              <LibraryLightbox
                photos={album.album_photos}
                start={lightbox}
                onClose={() => setLightbox(null)}
              />
            )}
          </>
        )}

        {/* footer */}
        <footer className="mt-20 border-t border-border-subtle pt-10 pb-6 text-center">
          <a href="https://reactiveshots.com" target="_blank" rel="noopener noreferrer">
            <span className="font-blackmud text-2xl tracking-tight text-brand">
              Reactive Shots
            </span>
          </a>
          <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-text-muted">
            Photography &amp; Video · Dallas, TX
          </p>
          <div className="mt-4 flex items-center justify-center gap-5 text-[11px] uppercase tracking-[0.2em] text-text-faint">
            <a
              href="https://reactiveshots.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-brand"
            >
              Website
            </a>
            <a
              href="https://www.instagram.com/reactiveshots/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-brand"
            >
              Instagram
            </a>
            <a
              href="https://reactiveshots.com/lets-talk"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-brand"
            >
              Book a Shoot
            </a>
          </div>
          <p className="mt-6 text-[10px] tracking-[0.2em] text-text-faint">
            © {new Date().getFullYear()} Reactive Shots
          </p>
        </footer>
      </div>
    </div>
  )
}
