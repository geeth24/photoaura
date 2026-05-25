"use client"

import { useEffect, useState, useCallback } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, deletePhoto } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import type { Album } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
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
import { Trash2, Upload, UploadCloud } from "lucide-react"
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

  useEffect(() => {
    fetchAlbum()
  }, [fetchAlbum])

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
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="mb-4 w-full"
              style={{ height: `${200 + (i % 3) * 80}px` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p>Album not found</p>
      </div>
    )
  }

  return (
    <div
      className="relative space-y-6"
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
        <div className="pointer-events-none fixed inset-3 z-40 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary bg-background/80 text-primary backdrop-blur-sm">
          <UploadCloud className="size-10" />
          <p className="text-lg font-medium">Drop photos to add to {album.album_name}</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{album.album_name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {album.image_count} {album.image_count === 1 ? "photo" : "photos"}
            </span>
            {album.shared && <Badge variant="secondary">Shared</Badge>}
            {album.upload && <Badge variant="secondary">Upload Enabled</Badge>}
          </div>
        </div>

        <div className="flex gap-2">
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
            onUploaded={fetchAlbum}
            trigger={
              <Button variant="outline" size="sm">
                <Upload className="size-4" />
                Upload
              </Button>
            }
          />
        )}
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" />
                Delete
              </Button>
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

      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {album.album_photos.map((photo) => (
          <div key={photo.file_metadata.filename} className="group relative mb-4 break-inside-avoid">
            <Link
              href={`/albums/${albumSlug}/${encodeURIComponent(photo.file_metadata.filename)}`}
              className="block cursor-zoom-in overflow-hidden rounded-sm bg-muted"
              scroll={false}
            >
              <Image
                src={photo.compressed_image}
                alt={photo.file_metadata.description || photo.file_metadata.filename}
                width={photo.file_metadata.width}
                height={photo.file_metadata.height}
                className="h-auto w-full transition-opacity hover:opacity-90"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                placeholder={photo.file_metadata.blur_data_url ? "blur" : "empty"}
                blurDataURL={photo.file_metadata.blur_data_url || undefined}
              />
            </Link>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <button
                    className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="size-4" />
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
          </div>
        ))}
      </div>
    </div>
  )
}
