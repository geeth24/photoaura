"use client"

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import { Heart, Minus, Play, Plus, Star, Trash2 } from "lucide-react"
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
import cdnImageLoader from "@/lib/cdn-image-loader"
import { hasSeenImage, markImageSeen } from "@/lib/image-cache"
import { isVideo, type Photo } from "@/lib/types"

// one tile width everywhere (grid, viewer placeholder, scrubber) so they all
// share a single warmed CloudFront object and the browser cache
export const TILE_WIDTH = 640
export const FULL_WIDTH = 2048

export const photoKey = (p: Photo) => `${p.file_metadata.album_id}:${p.file_metadata.filename}`
export const tileSrc = (p: Photo) => cdnImageLoader({ src: p.compressed_image, width: TILE_WIDTH })
export const fullSrc = (p: Photo) => cdnImageLoader({ src: p.image, width: FULL_WIDTH })

export function findTile(p: Photo): HTMLElement | null {
  if (typeof document === "undefined") return null
  return document.querySelector<HTMLElement>(`[data-photo="${CSS.escape(photoKey(p))}"]`)
}

// columns per density step, densest first; the middle step is the default
const STEPS = {
  phone: [5, 3, 2],
  tablet: [6, 4, 3],
  desktop: [7, 5, 3],
} as const
const DENSITY_KEY = "pa:grid-density"
// morphing every tile is lovely but costs a snapshot each; past this, crossfade
const MORPH_LIMIT = 180

// saved density, shared by every grid on the page
const densityListeners = new Set<() => void>()
function readDensity() {
  try {
    const raw = localStorage.getItem(DENSITY_KEY)
    const saved = raw == null ? NaN : Number(raw)
    return saved >= 0 && saved <= 2 ? saved : 1
  } catch {
    // private mode / blocked storage
    return 1
  }
}
function writeDensity(next: number) {
  try {
    localStorage.setItem(DENSITY_KEY, String(next))
  } catch {
    // ignore
  }
  densityListeners.forEach((l) => l())
}
function subscribeDensity(l: () => void) {
  densityListeners.add(l)
  return () => {
    densityListeners.delete(l)
  }
}

// hovering a tile warms its full-res so the viewer opens on a sharp image
const warmed = new Set<string>()
function warmFull(p: Photo) {
  if (isVideo(p)) return
  const url = fullSrc(p)
  if (warmed.has(url)) return
  warmed.add(url)
  const img = new window.Image()
  img.src = url
}

type Props = {
  photos: Photo[]
  onOpen: (photo: Photo) => void
  favorites?: Set<string>
  onToggleFavorite?: (filename: string) => void
  onDelete?: (filename: string) => void
  // admin, when a person is selected: pin this photo as their cover
  onSetCover?: (filename: string) => void
}

function PhotoGridImpl({
  photos,
  onOpen,
  favorites,
  onToggleFavorite,
  onDelete,
  onSetCover,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const step = useSyncExternalStore(subscribeDensity, readDensity, () => 1)
  const [morph, setMorph] = useState(false)
  const pinch = useRef<{ d: number; scale: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth))
    ro.observe(el)
    setWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  const steps = width < 640 ? STEPS.phone : width < 1024 ? STEPS.tablet : STEPS.desktop
  const cols = steps[step]

  const changeStep = useCallback((next: number) => {
    if (next < 0 || next > 2) return
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> }
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!doc.startViewTransition || reduce) {
      writeDensity(next)
      return
    }
    // names go on before the "old" snapshot, come off once the morph lands
    flushSync(() => setMorph(true))
    const t = doc.startViewTransition(() => flushSync(() => writeDensity(next)))
    // a hidden tab skips the morph; the step still lands
    t.ready.catch(() => {})
    t.finished.finally(() => setMorph(false))
  }, [])

  // two-finger pinch on the grid steps the density, like Photos
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    pinch.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale: 1 }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pinch.current || e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    pinch.current.scale = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.current.d
  }
  const onTouchEnd = () => {
    const p = pinch.current
    pinch.current = null
    if (!p) return
    // spread = bigger tiles = fewer columns
    if (p.scale > 1.15) changeStep(step + 1)
    else if (p.scale < 0.87) changeStep(step - 1)
  }

  return (
    <div className="space-y-3">
      <div className="hidden items-center justify-end gap-1 sm:flex">
        <button
          onClick={() => changeStep(step - 1)}
          disabled={step === 0}
          aria-label="Smaller photos"
          className="flex size-8 items-center justify-center text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={() => changeStep(step + 1)}
          disabled={step === 2}
          aria-label="Bigger photos"
          className="flex size-8 items-center justify-center text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        // edge to edge on a phone, whatever padding the page wraps us in
        className="grid touch-pan-y gap-[2px] max-sm:ml-[calc(50%-50vw)] max-sm:w-screen sm:gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {photos.map((p, i) => (
          <Tile
            key={photoKey(p)}
            photo={p}
            name={morph && i < MORPH_LIMIT ? `pa-tile-${i}` : undefined}
            onOpen={onOpen}
            favorite={favorites?.has(p.file_metadata.filename) ?? false}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
            onSetCover={onSetCover}
          />
        ))}
      </div>
    </div>
  )
}

export const PhotoGrid = memo(PhotoGridImpl)

type TileProps = {
  photo: Photo
  name?: string
  onOpen: (photo: Photo) => void
  favorite: boolean
  onToggleFavorite?: (filename: string) => void
  onDelete?: (filename: string) => void
  onSetCover?: (filename: string) => void
}

const Tile = memo(function Tile({
  photo,
  name,
  onOpen,
  favorite,
  onToggleFavorite,
  onDelete,
  onSetCover,
}: TileProps) {
  const m = photo.file_metadata
  const video = isVideo(photo)
  const src = tileSrc(photo)
  const [loaded, setLoaded] = useState(() => hasSeenImage(src))
  const [broken, setBroken] = useState(false)

  return (
    <div
      data-photo={photoKey(photo)}
      className="group relative aspect-square overflow-hidden bg-surface-elevated"
      style={{
        viewTransitionName: name,
        ...(m.blur_data_url && !loaded
          ? { backgroundImage: `url("${m.blur_data_url}")`, backgroundSize: "cover" }
          : null),
      }}
      onMouseEnter={() => warmFull(photo)}
    >
      <button
        type="button"
        onClick={() => onOpen(photo)}
        className="absolute inset-0 block size-full cursor-zoom-in"
        aria-label={m.description || m.filename}
      >
        {!broken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => {
              setLoaded(true)
              markImageSeen(src)
            }}
            // an older video may have no poster frame yet
            onError={() => setBroken(true)}
            className={`size-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.03] ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
        {video && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
              <Play className="ml-0.5 size-4 fill-current" />
            </span>
          </span>
        )}
      </button>

      {onToggleFavorite && !video && (
        <button
          onClick={() => onToggleFavorite(m.filename)}
          className={`absolute bottom-1.5 left-1.5 flex items-center justify-center rounded-full p-1.5 transition-all ${
            favorite
              ? "bg-black/35 text-white opacity-100"
              : "bg-black/35 text-white opacity-0 group-hover:opacity-100"
          }`}
          aria-label={favorite ? "Remove from picks" : "Add to picks"}
        >
          <Heart className="size-3.5" fill={favorite ? "currentColor" : "none"} />
        </button>
      )}

      {onSetCover && (
        <button
          onClick={() => onSetCover(m.filename)}
          className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.15em] text-white opacity-0 backdrop-blur transition-opacity hover:text-brand group-hover:opacity-100"
          aria-label="Set as cover"
        >
          <Star className="size-3" />
          Cover
        </button>
      )}

      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <button
                className="absolute right-1.5 top-1.5 rounded-full bg-black/45 p-1.5 text-white opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100"
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
              <AlertDialogAction variant="destructive" onClick={() => onDelete(m.filename)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
})
