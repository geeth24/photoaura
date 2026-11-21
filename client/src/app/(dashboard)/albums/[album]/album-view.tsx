"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch, deletePhoto, getPreviewOriginals, getUploadStatus, type UploadStatus } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { isVideo, type Album, type AlbumFace, type Photo } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
import { AlbumFaces } from "@/components/album-faces"
import { PhotoGrid } from "@/components/photo-grid"
import { MomentsView, type MomentGroup } from "@/components/moments-view"
import { ReelsStrip } from "@/components/reels-strip"
import { SmartGalleryPanel } from "@/components/smart-gallery-panel"
import { PhotoViewer, VideoViewer } from "@/components/photo-viewer"
import { InviteClientDialog } from "@/components/invite-client-dialog"
import { AlbumAccessDialog } from "@/components/album-access-dialog"
import { ManageDownloadsDialog } from "@/components/manage-downloads-dialog"
import { RenameAlbumDialog } from "@/components/rename-album-dialog"
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
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Trash2,
  Upload,
  ArrowLeft,
  UploadCloud,
  ScanFace,
  Loader2,
  Share2,
  Globe,
  Lock,
  Download,
  Heart,
  Users,
  UserPlus,
  Layers,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react"
import { downloadAlbumZip } from "@/lib/download"
import { SaveToPhotos } from "@/components/save-to-photos"
import { toast } from "sonner"
import Link from "next/link"

const toolbarButton =
  "flex size-10 items-center justify-center gap-2 border border-border-default text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary aria-expanded:border-border-strong aria-expanded:text-text-primary sm:w-auto sm:px-4"
const menuItem = "gap-2.5 px-3 py-2.5 text-[11px] uppercase tracking-[0.15em]"
// the menu popup forces destructive items to the accent color; win on specificity (icon via stroke)
const menuDestructive =
  "[&&&]:text-destructive! [&&&]:focus:bg-destructive/15! [&&&]:data-highlighted:bg-destructive/15!"
const menuLabel = "px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.25em] text-text-faint"

export function AlbumView({
  albumSlug,
  initialPhoto,
}: {
  albumSlug: string
  // opened straight on a photo (/albums/x/photo.jpg): show it over the album
  initialPhoto?: string
}) {
  const router = useRouter()
  const { user, isPreview, showAsPaid } = useAuth()
  const isAdmin = !!user && user.role !== "client"
  const [album, setAlbum] = useState<Album | null>(null)
  useDocumentTitle(album?.album_name)
  const [loading, setLoading] = useState(true)
  const search = useSearchParams()
  const [mediaTab, setMediaTab] = useState<"photos" | "videos" | "smart">(
    search.get("tab") === "videos" ? "videos" : search.get("tab") === "smart" ? "smart" : "photos",
  )
  // clients open on the studio's highlights once they're published
  const [scope, setScope] = useState<"highlights" | "all" | "moments">("highlights")
  const [deleting, setDeleting] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [downloadsOpen, setDownloadsOpen] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
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
    if (latestRevision && !isPreview) markRevisionSeen(albumSlug, latestRevision)
  }, [albumSlug, latestRevision, isPreview])

  // "Show as paid" in a preview: the gallery as it looks once unlocked, with the held originals
  const asPaid = isPreview && showAsPaid
  const albumLocked = !!album?.locked
  const locked = albumLocked && !asPaid
  const [originals, setOriginals] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!asPaid || !albumLocked) return
    let live = true
    getPreviewOriginals(albumSlug)
      .then((r) => live && setOriginals(r.originals))
      .catch(() => live && toast.error("Couldn't load the full-resolution files"))
    return () => {
      live = false
    }
  }, [asPaid, albumLocked, albumSlug])


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
    if (isPreview) {
      toast.info("Downloads are off while previewing")
      return
    }
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

  const handleRename = async (name: string) => {
    const previous = album?.album_name
    if (!previous) return
    setAlbum((a) => (a ? { ...a, album_name: name } : a))
    try {
      await apiFetch(`/album/${albumSlug}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      })
      toast.success("Album renamed")
    } catch (e) {
      setAlbum((a) => (a ? { ...a, album_name: previous } : a))
      toast.error(e instanceof Error ? e.message : "Couldn't rename the album")
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
    const picked = onlyFavorites
      ? mediaScoped.filter((p) => favorites.has(p.file_metadata.filename))
      : mediaScoped
    const clientView = !isAdmin && mediaTab === "photos"
    const highlightSet = clientView && album.highlights?.length ? new Set(album.highlights) : null
    const moments = clientView ? album.moments : null
    const active =
      scope === "highlights" && !highlightSet ? "all" : scope === "moments" && !moments?.length ? "all" : scope
    let momentGroups: MomentGroup[] | null = null
    let visiblePhotos = picked
    if (highlightSet && active === "highlights") {
      visiblePhotos = picked.filter((p) => highlightSet.has(p.file_metadata.filename))
    } else if (moments?.length && active === "moments") {
      const byName = new Map(picked.map((p) => [p.file_metadata.filename, p]))
      momentGroups = moments
        .map((moment) => ({
          moment,
          photos: moment.filenames.flatMap((f) => byName.get(f) ?? []),
        }))
        .filter((g) => g.photos.length > 0)
      visiblePhotos = momentGroups.flatMap((g) => g.photos)
    }
    // the viewer swipes stills only; videos open their own player
    const stills = visiblePhotos.filter((p) => !isVideo(p))
    return { hasVideos, videoCount, photoCount, visiblePhotos, stills, momentGroups, scope: active }
  }, [album, faces, selectedFace, mediaTab, onlyFavorites, favorites, revisionFilter, isAdmin, scope])

  const stillsRef = useRef<Photo[]>([])
  stillsRef.current = view?.stills ?? []

  // the grid keeps its light proof tiles; only the viewer opens the held original
  const viewerStills = useMemo(() => {
    const stills = view?.stills ?? []
    if (!asPaid || !albumLocked) return stills
    return stills.map((p) => {
      const url = originals[p.file_metadata.filename]
      return url ? { ...p, image: url } : p
    })
  }, [view, asPaid, albumLocked, originals])

  const openPhoto = useCallback((p: Photo) => {
    if (isVideo(p)) {
      setVideo(p)
      return
    }
    const i = stillsRef.current.findIndex((x) => x.file_metadata.filename === p.file_metadata.filename)
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

  const { hasVideos, videoCount, photoCount, visiblePhotos, momentGroups } = view!
  const isEmpty = album.album_photos.length === 0
  const reels = !isAdmin && mediaTab === "photos" && !isEmpty && view!.scope !== "moments" ? album.reels ?? [] : []
  const smartTab = isAdmin && !isEmpty && !!album.highlights?.length
  const countLabel = `${album.image_count} ${album.image_count === 1 ? "photo" : "photos"}`

  const chipButton =
    "flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors"
  const chipIdle =
    "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"

  const picksButton =
    favorites.size > 0 ? (
      <button
        onClick={() => setOnlyFavorites((v) => !v)}
        className={`${chipButton} ${onlyFavorites ? "border-brand text-brand" : chipIdle}`}
      >
        <Heart className="size-3" fill={onlyFavorites ? "currentColor" : "none"} />
        {favorites.size} {isAdmin ? "picked" : "picks"}
      </button>
    ) : null

  const downloadAllButton = (
    <button
      onClick={handleDownloadAll}
      disabled={zipping}
      aria-label="Download all"
      className={`${chipButton} ${chipIdle} disabled:opacity-50`}
    >
      {zipping ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      {isAdmin ? (
        <span>
          Download<span className="hidden sm:inline"> all</span>
        </span>
      ) : (
        "Download all"
      )}
    </button>
  )

  // anyone viewing the album can grab a share link
  const shareMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className={`${chipButton} ${chipIdle}`}>
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
            <span className="flex-1">{isPublic ? "Make private" : "Make public"}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

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
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
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

          <div className="flex items-start gap-3">
            <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
              {album.album_name}
            </h1>
            {isAdmin && (
              <RenameAlbumDialog albumName={album.album_name} onRename={handleRename} />
            )}
          </div>

          {isAdmin ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.2em] text-text-muted">
                <span>{countLabel}</span>
                {locked && (
                  <>
                    <span className="h-3 w-px bg-border-default" />
                    <span className="flex items-center gap-1.5 text-brand">
                      <Lock className="size-3" />
                      Preview
                    </span>
                  </>
                )}
                {album.shared && (
                  <>
                    <span className="h-3 w-px bg-border-default" />
                    <span>Shared</span>
                  </>
                )}
                {album.upload && (
                  <>
                    <span className="h-3 w-px bg-border-default" />
                    <span>Upload enabled</span>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {!locked && !isEmpty && downloadAllButton}
                {shareMenu}
                {picksButton}
              </div>
            </>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
                {countLabel}
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
              {picksButton}
              {/* clients asked for this: every original in one zip */}
              {locked ? (
                <span className="flex items-center gap-1.5 border border-brand/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-brand">
                  <Lock className="size-3" />
                  Preview
                </span>
              ) : isEmpty ? null : (
                downloadAllButton
              )}
              {shareMenu}
            </div>
          )}

          {/* phones can't get a zip into the camera roll — offer the share sheet */}
          {!locked && !isEmpty && !isPreview && <SaveToPhotos photos={album.album_photos} albumSlug={albumSlug} />}
        </div>

        {isAdmin && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {user && (
              <UploadAlbumDialog
                mode="existing"
                userId={user.id}
                albumSlug={albumSlug}
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
                  <button className="flex h-10 flex-1 items-center justify-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary sm:flex-none">
                    <Upload className="size-3.5" />
                    Upload
                  </button>
                }
              />
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button aria-label="Client" className={toolbarButton}>
                    <Users className="size-3.5" />
                    <span className="hidden sm:inline">Client</span>
                    <ChevronDown className="hidden size-3 sm:block" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuItem className={menuItem} onClick={() => setInviteOpen(true)}>
                  <UserPlus className="size-3.5" />
                  Invite client
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onClick={() => setAccessOpen(true)}>
                  <Users className="size-3.5" />
                  Manage access
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button aria-label="More actions" className={toolbarButton}>
                    {processing ? (
                      <Loader2 className="size-3.5 animate-spin text-brand" />
                    ) : (
                      <MoreHorizontal className="size-3.5" />
                    )}
                    <span className="hidden sm:inline">More</span>
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className={menuLabel}>Files</DropdownMenuLabel>
                  <DropdownMenuItem className={menuItem} onClick={() => setRevisionOpen(true)}>
                    <Layers className="size-3.5" />
                    Upload revision
                  </DropdownMenuItem>
                  {album.album_id != null && (
                    <DropdownMenuItem className={menuItem} onClick={() => setDownloadsOpen(true)}>
                      <Download className="size-3.5" />
                      Client downloads
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className={menuLabel}>Maintenance</DropdownMenuLabel>
                  <DropdownMenuItem
                    className={menuItem}
                    disabled={resyncing || processing}
                    onClick={handleResyncFaces}
                  >
                    {processing ? (
                      <Loader2 className="size-3.5 animate-spin text-brand" />
                    ) : (
                      <ScanFace className="size-3.5" />
                    )}
                    {processing ? "Re-detecting…" : resyncing ? "Starting…" : "Resync faces"}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className={`${menuItem} ${menuDestructive}`}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5 stroke-destructive" />
                  Delete album
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <InviteClientDialog
              albumSlug={albumSlug}
              albumName={album.album_name}
              open={inviteOpen}
              onOpenChange={setInviteOpen}
            />
            <AlbumAccessDialog
              albumSlug={albumSlug}
              albumName={album.album_name}
              open={accessOpen}
              onOpenChange={setAccessOpen}
            />
            {album.album_id != null && (
              <ManageDownloadsDialog
                albumId={album.album_id}
                albumSlug={albumSlug}
                albumName={album.album_name}
                open={downloadsOpen}
                onOpenChange={setDownloadsOpen}
              />
            )}
            <UploadRevisionDialog
              albumSlug={albumSlug}
              albumName={album.album_name}
              onUploaded={refresh}
              open={revisionOpen}
              onOpenChange={setRevisionOpen}
            />
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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

      {locked && <ProofBanner bookingNumber={album.booking_number} albumSlug={albumSlug} studio={isAdmin} />}
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
                ? "Making watermarked previews"
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

      {/* photos / videos / smart tabs — only when the album has video or scores */}
      {(hasVideos || smartTab) && (
        <Tabs
          value={mediaTab}
          onValueChange={(v) => setMediaTab(v as "photos" | "videos" | "smart")}
        >
          <TabsList>
            <TabsTrigger value="photos">{hasVideos ? `Photos (${photoCount})` : "Photos"}</TabsTrigger>
            {hasVideos && <TabsTrigger value="videos">Videos ({videoCount})</TabsTrigger>}
            {smartTab && <TabsTrigger value="smart">Smart</TabsTrigger>}
          </TabsList>
        </Tabs>
      )}

      {/* clients: the studio's highlights, everything, or the shoot moment by moment */}
      {!isAdmin && mediaTab === "photos" && (album.highlights?.length || album.moments?.length) ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Gallery view">
          {(
            [
              ...(album.highlights?.length ? [["highlights", "Highlights", album.highlights.length] as const] : []),
              ["all", "All", album.album_photos.filter((p) => !isVideo(p)).length] as const,
              ...(album.moments?.length ? [["moments", "Moments", album.moments.length] as const] : []),
            ]
          ).map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => setScope(id)}
              aria-pressed={view!.scope === id}
              className={`${chipButton} ${view!.scope === id ? "border-brand text-brand" : chipIdle}`}
            >
              {label}
              <span className="text-text-faint">{count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {reels.length > 0 && <ReelsStrip reels={reels} albumSlug={albumSlug} canDownload={!locked} />}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default px-6 py-24 text-center">
          <UploadCloud className="size-8 text-text-faint" />
          <p className="mt-5 font-heading text-2xl text-text-primary">
            {isAdmin ? "No photos yet" : "Your photos are on the way"}
          </p>
          <p className="mt-2 max-w-sm text-sm font-light text-text-muted">
            {isAdmin
              ? "Drop photos and clips anywhere on this page, or choose them from your computer."
              : "They'll show up here as soon as the studio uploads them."}
          </p>
          {isAdmin && user && (
            <button
              onClick={() => setUploadOpen(true)}
              className="mt-6 flex h-10 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary"
            >
              <Upload className="size-3.5" />
              Upload photos
            </button>
          )}
        </div>
      ) : mediaTab === "smart" && smartTab ? (
        <SmartGalleryPanel
          albumSlug={albumSlug}
          photos={album.album_photos}
          onOpen={openPhoto}
          onChanged={fetchAlbum}
        />
      ) : momentGroups ? (
        <MomentsView
          groups={momentGroups}
          onOpen={openPhoto}
          favorites={favorites}
          onToggleFavorite={isPreview ? undefined : toggleFavorite}
        />
      ) : (
        <PhotoGrid
          photos={visiblePhotos}
          onOpen={openPhoto}
          onDelete={isAdmin ? handleDeletePhoto : undefined}
          onSetCover={isAdmin && selectedFace ? handleSetCover : undefined}
          favorites={favorites}
          onToggleFavorite={isPreview ? undefined : toggleFavorite}
        />
      )}

      <PhotoViewer
        photos={viewerStills}
        openIndex={viewer?.index ?? null}
        deepLink={viewer?.deep}
        onClose={() => setViewer(null)}
        urlFor={photoUrl}
        closeUrl={`/albums/${albumSlug}${query}`}
        favorites={favorites}
        onToggleFavorite={isPreview ? undefined : toggleFavorite}
        slug={albumSlug}
        canDownload={!locked}
      />
      <VideoViewer
        photo={video}
        canDownload={!locked}
        onClose={() => {
          setVideo(null)
          if (initialPhoto) window.history.replaceState(window.history.state, "", `/albums/${albumSlug}`)
        }}
      />
    </div>
  )
}
