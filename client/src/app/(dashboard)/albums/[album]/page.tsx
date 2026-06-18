"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, deletePhoto, getUploadStatus, type UploadStatus } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { isVideo, type Album, type AlbumFace, type Photo } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
import { AlbumFaces } from "@/components/album-faces"
import { PhotoMasonry } from "@/components/photo-masonry"
import { InviteClientDialog } from "@/components/invite-client-dialog"
import { AlbumAccessDialog } from "@/components/album-access-dialog"
import { ManageDownloadsDialog } from "@/components/manage-downloads-dialog"
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Upload, ArrowLeft, UploadCloud, ScanFace, Loader2, Share2, Globe, Lock } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ album: string }>
}) {
  const { album: albumSlug } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role !== "client"
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [mediaTab, setMediaTab] = useState<"photos" | "videos">("photos")
  const [deleting, setDeleting] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [dragDepth, setDragDepth] = useState(0)
  const [faces, setFaces] = useState<AlbumFace[]>([])
  const [selectedFace, setSelectedFace] = useState<string | null>(null)

  const onPageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    setDragDepth(0)
    const media = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    )
    if (media.length) {
      setDroppedFiles(media)
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

  // poll background face processing (resync / upload) so we can show a live
  // spinner on the People row and refresh once it lands
  const [job, setJob] = useState<UploadStatus | null>(null)
  const wasActive = useRef(false)
  useEffect(() => {
    if (!isAdmin) return
    let on = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const s = await getUploadStatus(albumSlug)
        if (!on) return
        setJob(s)
        if (wasActive.current && !s.active) refresh() // just finished -> reload faces
        wasActive.current = s.active
        // poll fast while active, slow idle so a fresh resync is picked up
        timer = setTimeout(tick, s.active ? 1500 : 8000)
      } catch {
        if (on) timer = setTimeout(tick, 8000)
      }
    }
    tick()
    return () => {
      on = false
      clearTimeout(timer)
    }
  }, [albumSlug, isAdmin, refresh])

  const processing = !!job?.active

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

  const handleSetCover = async (filename: string) => {
    if (!selectedFace) return
    try {
      await apiFetch(`/faces/${selectedFace}/cover`, {
        method: "POST",
        body: JSON.stringify({ album_slug: albumSlug, filename }),
      })
      toast.success("Cover updated")
      fetchFaces()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't set cover")
    }
  }

  const [isPublic, setIsPublic] = useState(false)
  useEffect(() => setIsPublic(!!album?.public), [album?.public])

  const copyShare = async (publicLink: boolean) => {
    if (!album) return
    const base = `${window.location.origin}/share/${albumSlug}`
    const link = publicLink || !album.secret ? base : `${base}?s=${album.secret}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success(publicLink ? "Public link copied" : "Private link copied")
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access")
    }
  }

  const togglePublic = async () => {
    const next = !isPublic
    setIsPublic(next)
    try {
      await apiFetch(`/album/${albumSlug}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ public: next }),
      })
      toast.success(next ? "Gallery is now public" : "Gallery is now private")
    } catch (e) {
      setIsPublic(!next)
      toast.error(e instanceof Error ? e.message : "Couldn't change visibility")
    }
  }

  const [resyncing, setResyncing] = useState(false)
  const handleResyncFaces = async () => {
    if (resyncing) return
    setResyncing(true)
    try {
      const res = await apiFetch<{ message: string; photos: number }>(
        `/album/${albumSlug}/resync-faces`,
        { method: "POST" }
      )
      toast.success(
        `Re-detecting faces for ${res.photos} photos — this runs in the background.`
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start resync")
    } finally {
      setResyncing(false)
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
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
  const faceScoped = selectedFilenames
    ? album.album_photos.filter((p) =>
        selectedFilenames.has(p.file_metadata.filename)
      )
    : album.album_photos

  // photos / videos tabs — only when the album actually has video
  const hasVideos = album.album_photos.some((p) => isVideo(p))
  const videoCount = faceScoped.filter((p) => isVideo(p)).length
  const photoCount = faceScoped.length - videoCount
  const visiblePhotos = !hasVideos
    ? faceScoped
    : faceScoped.filter((p) => (mediaTab === "videos" ? isVideo(p) : !isVideo(p)))

  return (
    <div
      className="relative space-y-12"
      onDragEnter={(e) => {
        e.preventDefault()
        if (isAdmin && Array.from(e.dataTransfer.types).includes("Files")) {
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
            {/* anyone viewing the album can grab a share link */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center gap-1.5 border border-border-default px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
                    <Share2 className="size-3" />
                    Share
                    {isPublic && <Globe className="size-3 text-brand" />}
                  </button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => copyShare(false)}>
                  <Lock className="size-3.5" />
                  <span className="flex-1">Copy private link</span>
                </DropdownMenuItem>
                {isAdmin && isPublic && (
                  <DropdownMenuItem onClick={() => copyShare(true)}>
                    <Globe className="size-3.5" />
                    <span className="flex-1">Copy public link</span>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={togglePublic}>
                    {isPublic ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
                    <span className="flex-1">
                      {isPublic ? "Make private" : "Make public"}
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isAdmin && (
        <div className="flex flex-wrap gap-3">
          <InviteClientDialog albumSlug={albumSlug} albumName={album.album_name} />
          <AlbumAccessDialog albumSlug={albumSlug} albumName={album.album_name} />
          {album.album_id != null && (
            <ManageDownloadsDialog
              albumId={album.album_id}
              albumSlug={albumSlug}
              albumName={album.album_name}
            />
          )}
          <button
            onClick={handleResyncFaces}
            disabled={resyncing || processing}
            className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ScanFace className="size-3.5" />
            )}
            {processing ? "Re-detecting…" : resyncing ? "Starting…" : "Resync faces"}
          </button>
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
        )}
      </div>

      {/* people */}
      {processing && (
        <Link
          href={`/albums/${albumSlug}/processing`}
          className="flex items-center gap-3 border border-border-subtle bg-surface-elevated px-4 py-3 text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-brand" />
          <span className="text-[11px] font-medium uppercase tracking-[0.2em]">
            {job?.phase === "clustering" ? "Grouping people" : "Detecting faces"}
            {job && job.phase === "faces" && job.total > 0
              ? ` · ${job.current}/${job.total}`
              : "…"}
          </span>
          <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-text-faint">
            View progress
          </span>
        </Link>
      )}
      <AlbumFaces faces={faces} selected={selectedFace} onSelect={setSelectedFace} />

      {/* photos / videos tabs — only when the album has video */}
      {hasVideos && (
        <Tabs
          value={mediaTab}
          onValueChange={(v) => setMediaTab(v as "photos" | "videos")}
        >
          <TabsList>
            <TabsTrigger value="photos">Photos ({photoCount})</TabsTrigger>
            <TabsTrigger value="videos">Videos ({videoCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* justified masonry */}
      <PhotoMasonry
        photos={visiblePhotos}
        albumSlug={albumSlug}
        selectedFace={selectedFace}
        onDelete={isAdmin ? handleDeletePhoto : undefined}
        onSetCover={isAdmin && selectedFace ? handleSetCover : undefined}
      />
    </div>
  )
}
