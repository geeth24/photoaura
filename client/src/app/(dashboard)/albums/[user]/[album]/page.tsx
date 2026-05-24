"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import type { Album } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ user: string; album: string }>
}) {
  const { user: userName, album: albumSlug } = use(params)
  const router = useRouter()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    apiFetch<Album>(`/album/${userName}/${albumSlug}/`)
      .then(setAlbum)
      .catch(() => setAlbum(null))
      .finally(() => setLoading(false))
  }, [userName, albumSlug])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/album/${userName}/${albumSlug}/`, { method: "DELETE" })
      toast.success("Album deleted")
      router.push("/albums")
    } catch {
      toast.error("Failed to delete album")
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
    <div className="space-y-6">
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

      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {album.album_photos.map((photo) => (
          <div key={photo.file_metadata.filename} className="mb-4 break-inside-avoid">
            <div className="overflow-hidden rounded-sm bg-muted">
              <Image
                src={photo.compressed_image}
                alt={photo.file_metadata.description || photo.file_metadata.filename}
                width={photo.file_metadata.width}
                height={photo.file_metadata.height}
                className="w-full h-auto"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                placeholder={photo.file_metadata.blur_data_url ? "blur" : "empty"}
                blurDataURL={photo.file_metadata.blur_data_url || undefined}
              />
            </div>
            {(photo.file_metadata.description || photo.file_metadata.tags?.length) && (
              <div className="mt-1.5 space-y-1">
                {photo.file_metadata.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {photo.file_metadata.description}
                  </p>
                )}
                {photo.file_metadata.tags && photo.file_metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {photo.file_metadata.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
