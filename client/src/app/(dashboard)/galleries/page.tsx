"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { ImageIcon } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Skeleton } from "@/components/ui/skeleton"
import { GalleryGrid, type Home } from "@/components/client-home"

// every gallery a client has, newest first; the studio's library stays at /albums
export default function GalleriesPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== "client") router.replace("/albums")
  }, [user, router])

  if (user?.role !== "client") return null
  return <ClientGalleries />
}

function ClientGalleries() {
  useDocumentTitle("Your galleries")
  const [albums, setAlbums] = useState<Home["albums"] | null>(null)

  useEffect(() => {
    apiFetch<Home>("/me/home")
      .then((h) => setAlbums(h.albums))
      .catch(() => setAlbums([]))
  }, [])

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">Library</span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          Your galleries
        </h1>
        <p className="mt-3 text-sm font-light text-text-secondary">
          {albums == null
            ? "Loading galleries…"
            : `${albums.length} ${albums.length === 1 ? "gallery" : "galleries"}`}
        </p>
      </motion.div>

      {albums == null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <ImageIcon className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-xl text-text-primary">No galleries yet</p>
          <p className="mt-1 max-w-xs text-sm font-light text-text-muted">
            When your photographer shares a gallery, it shows up here.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <GalleryGrid albums={albums} />
        </motion.div>
      )}
    </div>
  )
}
