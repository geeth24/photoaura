"use client"

import { useEffect, useState, useCallback } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { apiFetch, deletePhoto } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import type { Album, AlbumFace } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
import { AlbumFaces } from "@/components/album-faces"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2, Upload, ArrowLeft, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ album: string }>
}) {
  const { album: albumSlug } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [dragDepth, setDragDepth] = useState(0)
  const [faces, setFaces] = useState<AlbumFace[]>([])
  const [selectedFace, setSelectedFace] = useState<string | null>(null)

  const onPageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragDepth(0)
    const imgs = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    )
    if (imgs.length) {
      setDroppedFiles(imgs)
      setUploadOpen(true)
    }
  }

  const fetchAlbum = useCallback(() => {
    apiFetch<Album>(`/album/${albumSlug}/`)
      .then(setAlbum)
      .catch(() => setAlbum(null))
      .finally(() => setLoading(false))
  }, [albumSlug])

  const fetchFaces = useCallback(() => {
    apiFetch<AlbumFace[]>(`/album/${albumSlug}/faces`)
      .then(setFaces)
      .catch(() => setFaces([]))
  }, [albumSlug])

  const refresh = useCallback(() => {
    fetchAlbum()
    fetchFaces()
  }, [fetchAlbum, fetchFaces])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleDeletePhoto = async (filename: string) => {
    if (!album) return
    try {
      await deletePhoto(album.slug, filename)
      setAlbum({
        ...album,
        album_photos: album.album_photos.filter(
          (p) => p.file_metadata.filename !== filename
        ),
        image_count: Math.max(0, album.image_count - 1),
      })
      toast.success("Photo deleted")
    } catch {
      toast.error("Failed to delete photo")
    }
  }

  const handleDelete = async () => {
    if (!album) return
    setDeleting(true)
    try {
      await apiFetch(`/album/delete/${albumSlug}/`, { method: "DELETE" })
      toast.success("Album deleted")
      router.push("/albums")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete album")
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="mb-3 w-full"
              style={{ height: `${200 + (i % 3) * 80}px` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
        <p className="font-heading text-2xl text-text-primary">Album not found</p>
        <p className="mt-2 text-sm font-light text-text-muted">
          This collection may have been removed.
        </p>
        <Link
          href="/albums"
          className="mt-6 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Back to Albums
        </Link>
      </div>
    )
  }

  const selectedFilenames =
    selectedFace != null
      ? new Set(faces.find((f) => f.face_id === selectedFace)?.filenames ?? [])
      : null
  const visiblePhotos = selectedFilenames
    ? album.album_photos.filter((p) =>
        selectedFilenames.has(p.file_metadata.filename)
      )
    : album.album_photos

  return (
    <div
      className="relative space-y-12"
      onDragEnter={(e) => {
        e.preventDefault()
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          setDragDepth((d) => d + 1)
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault()
        setDragDepth((d) => Math.max(0, d - 1))
      }}
      onDrop={onPageDrop}
    >
      {dragDepth > 0 && (
        <div className="pointer-events-none fixed inset-3 z-40 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-brand bg-surface/85 text-brand backdrop-blur-sm">
          <UploadCloud className="size-10" />
          <p className="font-heading text-2xl tracking-tight">
            Drop to add to {album.album_name}
          </p>
        </div>
      )}

      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Link
            href="/albums"
            className="group mb-4 flex items-center gap-4 text-text-muted transition-colors hover:text-text-primary"
          >
            <span className="block h-px w-12 bg-brand" />
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
              <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
              Albums
            </span>
          </Link>

          <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
            {album.album_name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
              {album.image_count} {album.image_count === 1 ? "photo" : "photos"}
            </span>
            {album.shared && (
              <span className="border border-border-default px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
                Shared
              </span>
            )}
            {album.upload && (
              <span className="border border-border-default px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
                Upload Enabled
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {user && (
            <UploadAlbumDialog
              mode="existing"
              userId={user.id}
              albumName={album.album_name}
              open={uploadOpen}
              onOpenChange={(o) => {
                setUploadOpen(o)
                if (!o) setDroppedFiles([])
              }}
              initialFiles={droppedFiles}
              lockFaceDetection={!!album.face_detection}
              onUploaded={refresh}
              trigger={
                <button className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
                  <Upload className="size-3.5" />
                  Upload
                </button>
              }
            />
          )}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <button className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted transition-colors hover:border-destructive/50 hover:text-destructive">
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete album?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{album.album_name}&quot; and all its
                  photos. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  variant="destructive"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* people */}
      <AlbumFaces faces={faces} selected={selectedFace} onSelect={setSelectedFace} />

      {/* photo grid */}
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {visiblePhotos.map((photo, i) => (
          <motion.div
            key={photo.file_metadata.filename}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: Math.min(i * 0.02, 0.3),
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group relative mb-3 break-inside-avoid"
          >
            <Link
              href={`/albums/${albumSlug}/${encodeURIComponent(photo.file_metadata.filename)}`}
              className="block cursor-zoom-in overflow-hidden border border-border-subtle bg-surface-elevated"
              scroll={false}
            >
              <Image
                src={photo.compressed_image}
                alt={photo.file_metadata.description || photo.file_metadata.filename}
                width={photo.file_metadata.width}
                height={photo.file_metadata.height}
                className="h-auto w-full transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                placeholder={photo.file_metadata.blur_data_url ? "blur" : "empty"}
                blurDataURL={photo.file_metadata.blur_data_url || undefined}
              />
            </Link>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <button
                    className="absolute right-2 top-2 border border-border-strong bg-surface/70 p-1.5 text-text-secondary opacity-0 backdrop-blur transition-all hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete photo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes this photo from the album.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => handleDeletePhoto(photo.file_metadata.filename)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
