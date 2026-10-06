"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch, deletePhoto, getUploadStatus, type UploadStatus } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { isVideo, type Album, type AlbumFace, type Photo } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
import { AlbumFaces } from "@/components/album-faces"
import { PhotoGrid } from "@/components/photo-grid"
import { PhotoViewer, VideoViewer } from "@/components/photo-viewer"
import { InviteClientDialog } from "@/components/invite-client-dialog"
import { AlbumAccessDialog } from "@/components/album-access-dialog"
import { ManageDownloadsDialog } from "@/components/manage-downloads-dialog"
import { UploadRevisionDialog } from "@/components/upload-revision-dialog"
import { AlbumRevisions } from "@/components/album-revisions"
import { RevisionBanner } from "@/components/revision-banner"
import { ProofBanner } from "@/components/proof-banner"
import { markRevisionSeen } from "@/lib/revision-seen"
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
import { Trash2, Upload, ArrowLeft, UploadCloud, ScanFace, Loader2, Share2, Globe, Lock, Download, Heart } from "lucide-react"
import { downloadAlbumZip } from "@/lib/download"
import { SaveToPhotos } from "@/components/save-to-photos"
import { toast } from "sonner"
import Link from "next/link"

export function AlbumView({
  albumSlug,
  initialPhoto,
}: {
  albumSlug: string
  // opened straight on a photo (/albums/x/photo.jpg): show it over the album
  initialPhoto?: string
}) {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = !!user && user.role !== "client"
  const [album, setAlbum] = useState<Album | null>(null)
  useDocumentTitle(album?.album_name)
  const [loading, setLoading] = useState(true)
  const search = useSearchParams()
  const [mediaTab, setMediaTab] = useState<"photos" | "videos">(
    search.get("tab") === "videos" ? "videos" : "photos",
  )
  const [deleting, setDeleting] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [dragDepth, setDragDepth] = useState(0)
  const [faces, setFaces] = useState<AlbumFace[]>([])
  const [selectedFace, setSelectedFace] = useState<string | null>(search.get("face"))
  const [viewer, setViewer] = useState<{ index: number; deep: boolean } | null>(null)
  const [video, setVideo] = useState<Photo | null>(null)
  // ?revision=N (from the revision email) opens on just that revision's photos
  const [revisionFilter, setRevisionFilter] = useState<{
    number: number
    // exact set from the history list; otherwise match revision_number
    filenames?: Set<string>
  } | null>(() => {
    const n = Number(search.get("revision"))
    return n > 0 ? { number: n } : null
  })

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

  const fetchFavorites = useCallback(() => {
    apiFetch<{ filenames: string[] }>(`/album/${albumSlug}/favorites`)
      .then((r) => setFavorites(new Set(r.filenames)))
      .catch(() => setFavorites(new Set()))
  }, [albumSlug])

  const favoritesRef = useRef(favorites)
  favoritesRef.current = favorites
  const toggleFavorite = useCallback(
    async (filename: string) => {
      const nowFavorite = !favoritesRef.current.has(filename)
      const flip = (on: boolean) =>
        setFavorites((prev) => {
          const next = new Set(prev)
          if (on) next.add(filename)
          else next.delete(filename)
          return next
        })
      flip(nowFavorite)
      try {
        await apiFetch(`/album/${albumSlug}/favorites`, {
          method: "POST",
          body: JSON.stringify({ filename, favorite: nowFavorite }),
        })
      } catch {
        // put it back if the server disagreed
        flip(!nowFavorite)
        toast.error("Couldn't save that pick")
      }
    },
    [albumSlug],
  )

  const fetchFaces = useCallback(() => {
    apiFetch<AlbumFace[]>(`/album/${albumSlug}/faces`)
      .then(setFaces)
      .catch(() => setFaces([]))
  }, [albumSlug])

  const refresh = useCallback(() => {
    fetchAlbum()
    fetchFaces()
    fetchFavorites()
  }, [fetchAlbum, fetchFaces, fetchFavorites])

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

  const latestRevision = album?.revision?.number ?? 0
  useEffect(() => {
    if (latestRevision) markRevisionSeen(albumSlug, latestRevision)
  }, [albumSlug, latestRevision])

  const handleDeletePhoto = useCallback(
    async (filename: string) => {
      try {
        await deletePhoto(albumSlug, filename)
        setAlbum((a) =>
          a
            ? {
                ...a,
                album_photos: a.album_photos.filter(
                  (p) => p.file_metadata.filename !== filename,
                ),
                image_count: Math.max(0, a.image_count - 1),
              }
            : a,
        )
        toast.success("Photo deleted")
      } catch {
        toast.error("Failed to delete photo")
      }
    },
    [albumSlug],
  )

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

  const handleSetCover = useCallback(
    async (filename: string) => {
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
    },
    [selectedFace, albumSlug, fetchFaces],
  )

  const handleDownloadAll = async () => {
    if (zipping) return
    setZipping(true)
    try {
      await downloadAlbumZip(albumSlug)
      toast.success("Preparing your download — the zip will start shortly")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the download")
    } finally {
      setZipping(false)
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

  const view = useMemo(() => {
    if (!album) return null
    const selectedFilenames =
      selectedFace != null
        ? new Set(faces.find((f) => f.face_id === selectedFace)?.filenames ?? [])
        : null
    const revisionScoped = revisionFilter
      ? album.album_photos.filter((p) =>
          revisionFilter.filenames
            ? revisionFilter.filenames.has(p.file_metadata.filename)
            : p.file_metadata.revision_number === revisionFilter.number,
        )
      : album.album_photos
    const faceScoped = selectedFilenames
      ? revisionScoped.filter((p) => selectedFilenames.has(p.file_metadata.filename))
      : revisionScoped
    // photos / videos tabs — only when the album actually has video
    const hasVideos = album.album_photos.some((p) => isVideo(p))
    const videoCount = faceScoped.filter((p) => isVideo(p)).length
    const photoCount = faceScoped.length - videoCount
    const mediaScoped = !hasVideos
      ? faceScoped
      : faceScoped.filter((p) => (mediaTab === "videos" ? isVideo(p) : !isVideo(p)))
    const visiblePhotos = onlyFavorites
      ? mediaScoped.filter((p) => favorites.has(p.file_metadata.filename))
      : mediaScoped
    // the viewer swipes stills only; videos open their own player
    const stills = visiblePhotos.filter((p) => !isVideo(p))
    return { hasVideos, videoCount, photoCount, visiblePhotos, stills }
  }, [album, faces, selectedFace, mediaTab, onlyFavorites, favorites, revisionFilter])

  const stillsRef = useRef<Photo[]>([])
  stillsRef.current = view?.stills ?? []

  const openPhoto = useCallback((p: Photo) => {
    if (isVideo(p)) {
      setVideo(p)
      return
    }
    const i = stillsRef.current.indexOf(p)
    if (i >= 0) setViewer({ index: i, deep: false })
  }, [])

  // a /albums/x/photo.jpg link opens on that photo once the album is in
  const deepOpened = useRef(false)
  useEffect(() => {
    if (!initialPhoto || deepOpened.current || !view) return
    deepOpened.current = true
    const i = view.stills.findIndex((p) => p.file_metadata.filename === initialPhoto)
    if (i >= 0) {
      setViewer({ index: i, deep: true })
      return
    }
    const v = album?.album_photos.find((p) => p.file_metadata.filename === initialPhoto)
    if (v && isVideo(v)) setVideo(v)
  }, [initialPhoto, view, album])

  const query = useMemo(() => {
    const q = new URLSearchParams()
    if (selectedFace) q.set("face", selectedFace)
    if (revisionFilter) q.set("revision", String(revisionFilter.number))
    const s = q.toString()
    return s ? `?${s}` : ""
  }, [selectedFace, revisionFilter])
  const photoUrl = useCallback(
    (p: Photo) =>
      `/albums/${albumSlug}/${encodeURIComponent(p.file_metadata.filename)}${query}`,
    [albumSlug, query],
  )

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

  const { hasVideos, videoCount, photoCount, visiblePhotos, stills } = view!

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
            {favorites.size > 0 && (
              <button
                onClick={() => setOnlyFavorites((v) => !v)}
                className={`flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors ${
                  onlyFavorites
                    ? "border-brand text-brand"
                    : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                }`}
              >
                <Heart className="size-3" fill={onlyFavorites ? "currentColor" : "none"} />
                {favorites.size} {isAdmin ? "picked" : "picks"}
              </button>
            )}
            {/* clients asked for this — every original in one zip */}
            {album.locked ? (
              <span className="flex items-center gap-1.5 border border-brand/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-brand">
                <Lock className="size-3" />
                Proof
              </span>
            ) : (
              <button
                onClick={handleDownloadAll}
                disabled={zipping}
                className="flex items-center gap-1.5 border border-border-default px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
              >
                {zipping ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Download className="size-3" />
                )}
                Download all
              </button>
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

          {/* phones can't get a zip into the camera roll — offer the share sheet */}
          {!album.locked && <SaveToPhotos photos={album.album_photos} albumSlug={albumSlug} />}
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
          <UploadRevisionDialog
            albumSlug={albumSlug}
            albumName={album.album_name}
            onUploaded={refresh}
          />
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

      {album.locked && <ProofBanner bookingNumber={album.booking_number} albumSlug={albumSlug} studio={isAdmin} />}
      {album.revision && (
        <RevisionBanner
          revision={album.revision}
          showing={revisionFilter?.number ?? null}
          onShow={(n) => setRevisionFilter(n ? { number: n } : null)}
        />
      )}
      {isAdmin && latestRevision > 0 && (
        <AlbumRevisions
          albumSlug={albumSlug}
          latest={latestRevision}
          onShow={(number, filenames) =>
            setRevisionFilter({ number, filenames: new Set(filenames) })
          }
        />
      )}

      {/* proof lock/unlock jobs aren't face work; no processing page for them */}
      {processing && (job?.kind === "lock" || job?.kind === "unlock") && (
        <div className="flex items-center gap-3 border border-border-subtle bg-surface-elevated px-4 py-3 text-text-secondary">
          <Loader2 className="size-4 shrink-0 animate-spin text-brand" />
          <span className="text-[11px] font-medium uppercase tracking-[0.2em]">
            {job.phase === "warming"
              ? "Warming the CDN"
              : job.kind === "lock"
                ? "Making watermarked proofs"
                : "Restoring full-resolution files"}
            {job.total > 0 && job.phase !== "warming" ? ` · ${job.current}/${job.total}` : "…"}
          </span>
        </div>
      )}

      {/* people */}
      {processing && job?.kind !== "lock" && job?.kind !== "unlock" && (
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

      <PhotoGrid
        photos={visiblePhotos}
        onOpen={openPhoto}
        onDelete={isAdmin ? handleDeletePhoto : undefined}
        onSetCover={isAdmin && selectedFace ? handleSetCover : undefined}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />

      <PhotoViewer
        photos={stills}
        openIndex={viewer?.index ?? null}
        deepLink={viewer?.deep}
        onClose={() => setViewer(null)}
        urlFor={photoUrl}
        closeUrl={`/albums/${albumSlug}${query}`}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        slug={albumSlug}
        canDownload={!album.locked}
      />
      <VideoViewer
        photo={video}
        canDownload={!album.locked}
        onClose={() => {
          setVideo(null)
          if (initialPhoto) window.history.replaceState(window.history.state, "", `/albums/${albumSlug}`)
        }}
      />
    </div>
  )
}
