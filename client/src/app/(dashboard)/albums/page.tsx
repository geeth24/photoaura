"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Album } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
import { Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function AlbumsPage() {
  const { user } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlbums = useCallback(() => {
    if (!user) return
    apiFetch<Album[]>(`/albums/?user_id=${user.id}`)
      .then(setAlbums)
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    fetchAlbums()
  }, [fetchAlbums])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Albums</h1>
        {user && (
          <UploadAlbumDialog
            mode="new"
            userId={user.id}
            onUploaded={fetchAlbums}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New Album
              </Button>
            }
          />
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album) => (
            <Link key={album.slug} href={`/albums/${album.slug}`}>
              <Card className="group cursor-pointer overflow-hidden transition-colors hover:bg-muted/50">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  {album.album_photos?.[0] ? (
                    <Image
                      src={album.album_photos[0].compressed_image}
                      alt={album.album_name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      No photos
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium truncate">{album.album_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {album.image_count} {album.image_count === 1 ? "photo" : "photos"}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && albums.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p>No albums found</p>
        </div>
      )}
    </div>
  )
}
