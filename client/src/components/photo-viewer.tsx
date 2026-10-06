"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import PhotoSwipe, { type SlideData } from "photoswipe"
import "photoswipe/style.css"
import { Columns2, Heart, Info, X } from "lucide-react"
import { DownloadMenu } from "@/components/download-menu"
import { PhotoInfoPanel } from "@/components/photo-info-panel"
import { PhotoCompare } from "@/components/photo-compare"
import { findTile, fullSrc, photoKey, tileSrc } from "@/components/photo-grid"
import { getPhotoVersions } from "@/lib/api"
import type { Photo, PhotoVersion } from "@/lib/types"

const OPEN_MS = 440
const CLOSE_MS = 400
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"

// phones get the photo edge to edge; wider screens leave room for the bars
function padFor(vw: number) {
  return vw < 768
    ? { top: 0, bottom: 0, left: 0, right: 0 }
    : { top: 76, bottom: 104, left: 56, right: 56 }
}

function dims(p: Photo) {
  return { w: p.file_metadata.width || 1600, h: p.file_metadata.height || 1067 }
}

// where PhotoSwipe will land the photo at its "fit" zoom
function fitRect(p: Photo) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = padFor(vw)
  const aw = vw - pad.left - pad.right
  const ah = vh - pad.top - pad.bottom
  const { w, h } = dims(p)
  const s = Math.min(1, aw / w, ah / h)
  const dw = w * s
  const dh = h * s
  return { x: pad.left + (aw - dw) / 2, y: pad.top + (ah - dh) / 2, w: dw, h: dh }
}

// The grid zooms toward the tapped tile as the photo grows out of it, so the
// neighbours fly outward instead of just vanishing under a black backdrop.
function zoomRoot(tile: HTMLElement) {
  return tile.closest<HTMLElement>("[data-zoom-root]") ?? tile.closest<HTMLElement>("main")
}

// returns the tile's rect in the grid's resting layout
function pushIn(root: HTMLElement, tile: HTMLElement, p: Photo, animate: boolean, ms: number) {
  root.style.transition = "none"
  root.style.transform = ""
  const rr = root.getBoundingClientRect()
  let t = tile.getBoundingClientRect()
  if (!animate && (t.bottom < 0 || t.top > window.innerHeight)) {
    tile.scrollIntoView({ block: "center" })
    t = tile.getBoundingClientRect()
  }
  const d = fitRect(p)
  const { w, h } = dims(p)
  // the square tile is a centre crop, so its short side is the photo's short side
  const k = w < h ? d.w / t.width : d.h / t.height
  const cx = t.left + t.width / 2
  const cy = t.top + t.height / 2
  root.style.transformOrigin = `${cx - rr.left}px ${cy - rr.top}px`
  root.style.willChange = "transform"
  const target = `translate(${d.x + d.w / 2 - cx}px, ${d.y + d.h / 2 - cy}px) scale(${k})`
  if (animate) {
    void root.offsetWidth
    root.style.transition = `transform ${ms}ms ${EASE}`
  }
  root.style.transform = target
  return t
}

function release(root: HTMLElement, ms: number) {
  // commit the zoomed frame first, or the transition has nothing to start from
  void root.offsetWidth
  root.style.transition = `transform ${ms}ms ${EASE}`
  root.style.transform = ""
  window.setTimeout(() => {
    root.style.transition = ""
    root.style.transformOrigin = ""
    root.style.willChange = ""
  }, ms + 40)
}

function reset(root: HTMLElement | null) {
  if (!root) return
  root.style.transition = ""
  root.style.transform = ""
  root.style.transformOrigin = ""
  root.style.willChange = ""
}

function takenAt(p: Photo): Date | null {
  let raw: unknown = p.file_metadata.exif_data
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
      if (typeof raw === "string") raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  const e = (raw ?? {}) as Record<string, unknown>
  const s = String(e.DateTimeOriginal ?? e.DateTime ?? "")
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  return isNaN(d.getTime()) ? null : d
}

type Props = {
  // the swipeable set — stills only
  photos: Photo[]
  openIndex: number | null
  onClose: () => void
  // opened from a link rather than a tap: fade in, and the URL is already ours
  deepLink?: boolean
  // keep the address bar on the photo being viewed
  urlFor?: (p: Photo) => string
  closeUrl?: string
  favorites?: Set<string>
  onToggleFavorite?: (filename: string) => void
  slug?: string
  // false on a proof-locked album
  canDownload?: boolean
}

export function PhotoViewer({
  photos,
  openIndex,
  onClose,
  deepLink = false,
  urlFor,
  closeUrl,
  favorites,
  onToggleFavorite,
  slug,
  canDownload = true,
}: Props) {
  const pswpRef = useRef<PhotoSwipe | null>(null)
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  const [index, setIndex] = useState(0)
  const [chrome, setChrome] = useState(true)
  const [info, setInfo] = useState(false)
  const [dragging, setDragging] = useState(false)
  const infoRef = useRef(false)
  // earlier versions of revised photos, fetched the first time one is viewed
  const [versions, setVersions] = useState<Record<number, PhotoVersion[]>>({})
  // key of the photo open in the before/after view
  const [compare, setCompare] = useState<string | null>(null)
  const compareRef = useRef(false)

  // latest props for PhotoSwipe's long-lived handlers
  const live = useRef({ photos, onClose, urlFor, closeUrl })
  useLayoutEffect(() => {
    infoRef.current = info
    compareRef.current = compare != null
    live.current = { photos, onClose, urlFor, closeUrl }
  })

  useEffect(() => {
    if (openIndex == null || pswpRef.current) return
    const list = live.current.photos
    const start = list[openIndex]
    if (!start) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const firstTile = findTile(start)
    const root = firstTile ? zoomRoot(firstTile) : null
    const zoomed = !deepLink && !reduce && !!firstTile

    const items: SlideData[] = list.map((p) => {
      const { w, h } = dims(p)
      return {
        src: fullSrc(p),
        msrc: tileSrc(p),
        width: w,
        height: h,
        alt: p.file_metadata.description || p.file_metadata.filename,
        thumbCropped: true,
      }
    })

    const pswp = new PhotoSwipe({
      dataSource: items,
      index: openIndex,
      mainClass: "pa-viewer",
      bgOpacity: 1,
      spacing: 0.06,
      loop: false,
      showHideAnimationType: reduce ? "none" : zoomed ? "zoom" : "fade",
      showAnimationDuration: OPEN_MS,
      hideAnimationDuration: CLOSE_MS,
      easing: EASE,
      paddingFn: (vp) => padFor(vp.x),
      initialZoomLevel: "fit",
      secondaryZoomLevel: (z) => Math.max(z.fit * 1.6, Math.min(z.fit * 2.6, 1)),
      maxZoomLevel: (z) => Math.max(z.fit * 5, 1),
      wheelToZoom: true,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      imageClickAction: "zoom",
      doubleTapAction: "zoom",
      bgClickAction: "close",
      tapAction: () => setChrome((v) => !v),
      arrowPrev: true,
      arrowNext: true,
      zoom: false,
      close: false,
      counter: false,
      preload: [1, 2],
      preloaderDelay: 400,
      // menus portal to <body>; the trap would yank focus back and shut them
      trapFocus: false,
    })
    pswpRef.current = pswp

    // closing: a stand-in parked where the tile rests, measured while the page stays zoomed
    let proxy: HTMLElement | null = null
    // the tile to fly back to is always the one on screen now, not the one we opened
    pswp.addFilter("thumbEl", (el, _data, i) =>
      proxy && i === pswp.currIndex ? proxy : (findTile(live.current.photos[i]) ?? el!),
    )

    let pushed = false
    let popped = false
    let closingRoot: HTMLElement | null = null
    const onPop = () => {
      popped = true
      pswp.close()
    }

    pswp.on("beforeOpen", () => {
      setIndex(pswp.currIndex)
      if (!deepLink) {
        const url = live.current.urlFor?.(start) ?? window.location.href
        window.history.pushState({ ...window.history.state, paViewer: true }, "", url)
        pushed = true
      }
      window.addEventListener("popstate", onPop)
      document.documentElement.style.overflow = "hidden"
    })

    pswp.on("openingAnimationStart", () => {
      if (zoomed && root && firstTile) pushIn(root, firstTile, start, true, OPEN_MS)
    })

    pswp.on("openingAnimationEnd", () => {
      // a link-opened viewer still flies back into the grid on close
      if (!reduce) pswp.options.showHideAnimationType = "zoom"
    })

    pswp.on("change", () => {
      const i = pswp.currIndex
      setIndex(i)
      const p = live.current.photos[i]
      const url = p && live.current.urlFor?.(p)
      // straight to the History prototype: Next's patched copy would re-render
      // the whole album page on every swipe
      if (url) History.prototype.replaceState.call(window.history, window.history.state, "", url)
    })

    pswp.on("verticalDrag", () => setDragging(true))
    pswp.on("pointerUp", () => setDragging(false))

    pswp.on("keydown", (e) => {
      // the compare slider owns the arrows; Escape backs out to the photo
      if (compareRef.current) {
        e.preventDefault()
        if (e.originalEvent.key === "Escape") setCompare(null)
        return
      }
      // an open menu owns the keyboard (arrows, Escape)
      if (document.querySelector('[role="menu"]')) {
        e.preventDefault()
        return
      }
      if (e.originalEvent.key !== "Escape") return
      if (infoRef.current) {
        e.preventDefault()
        setInfo(false)
      }
    })

    pswp.on("close", () => {
      setChrome(false)
      setInfo(false)
      if (reduce || pswp.options.showHideAnimationType !== "zoom") return
      const p = live.current.photos[pswp.currIndex]
      const tile = p ? findTile(p) : null
      closingRoot = tile ? zoomRoot(tile) : null
      if (!p || !tile || !closingRoot) return
      // re-zoom around the tile we're returning to — possibly a different one
      // after swiping — all in one task, so the screen never shows the grid at
      // rest. PhotoSwipe starts its animation ~30ms later; a drag-to-close has a
      // see-through backdrop, so an un-zoomed grid would flash in that gap.
      const rest = pushIn(closingRoot, tile, p, false, 0)
      proxy = document.createElement("div")
      proxy.style.cssText = `position:fixed;left:${rest.left}px;top:${rest.top}px;width:${rest.width}px;height:${rest.height}px;visibility:hidden;pointer-events:none`
      document.body.appendChild(proxy)
    })

    pswp.on("closingAnimationStart", () => {
      if (closingRoot) release(closingRoot, CLOSE_MS)
    })

    pswp.on("destroy", () => {
      window.removeEventListener("popstate", onPop)
      document.documentElement.style.overflow = ""
      proxy?.remove()
      if (!closingRoot) reset(root)
      if (pushed && !popped) window.history.back()
      else if (!pushed && live.current.closeUrl) {
        window.history.replaceState(window.history.state, "", live.current.closeUrl)
      }
      pswpRef.current = null
      setLayer(null)
      setChrome(true)
      setDragging(false)
      setCompare(null)
      live.current.onClose()
    })

    // our controls live inside PhotoSwipe's root, beside its gesture layer
    pswp.on("firstUpdate", () => {
      if (!pswp.element) return
      const el = document.createElement("div")
      el.className = "pa-viewer-layer"
      pswp.element.appendChild(el)
      setLayer(el)
    })

    pswp.init()
  }, [openIndex, deepLink])

  // PhotoSwipe's own arrows follow the rest of the chrome
  useEffect(() => {
    pswpRef.current?.element?.classList.toggle("pa-chrome-hidden", !chrome || dragging)
  }, [chrome, dragging])

  useEffect(() => {
    return () => {
      pswpRef.current?.destroy()
    }
  }, [])

  const current = layer ? photos[index] : undefined
  const currentId = current?.file_metadata.id
  const revised = (current?.file_metadata.version ?? 1) > 1
  useEffect(() => {
    if (!revised || currentId == null || versions[currentId]) return
    getPhotoVersions(currentId)
      .then((v) => setVersions((all) => ({ ...all, [currentId]: v })))
      .catch(() => {})
  }, [revised, currentId, versions])

  const goTo = useCallback((i: number) => pswpRef.current?.goTo(i), [])
  const close = useCallback(() => pswpRef.current?.close(), [])

  if (!layer || !current) return null

  const when = takenAt(current)
  const fav = favorites?.has(current.file_metadata.filename) ?? false
  const shown = chrome && !dragging
  const history = currentId != null ? (versions[currentId] ?? []) : []
  const canCompare = revised && history.length > 1
  const comparing = canCompare && compare === photoKey(current)

  return createPortal(
    <>
      {comparing && (
        <PhotoCompare
          versions={history}
          pad={padFor(window.innerWidth)}
          onClose={() => setCompare(null)}
        />
      )}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-3 pb-12 pt-[max(env(safe-area-inset-top),12px)] sm:px-6 sm:pt-5">
          <button
            onClick={close}
            aria-label="Close"
            className={`flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 ${
              shown ? "pointer-events-auto" : ""
            }`}
          >
            <X className="size-5" />
          </button>

          <div className="min-w-0 pt-1 text-center text-white">
            {when ? (
              <>
                <p className="truncate text-[15px] font-medium leading-tight">
                  {when.toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="mt-0.5 text-[12px] text-white/65">
                  {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {"  ·  "}
                  {index + 1} of {photos.length}
                  {revised && `  ·  v${current.file_metadata.version}`}
                </p>
              </>
            ) : (
              <p className="pt-1.5 text-[14px] font-medium tabular-nums">
                {index + 1} <span className="text-white/55">of {photos.length}</span>
                {revised && <span className="text-white/55"> · v{current.file_metadata.version}</span>}
              </p>
            )}
          </div>

          <div
            className={`flex items-center gap-1 rounded-full bg-white/10 p-0.5 text-white backdrop-blur-md ${
              shown ? "pointer-events-auto" : ""
            }`}
          >
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(current.file_metadata.filename)}
                aria-label={fav ? "Remove from picks" : "Add to picks"}
                className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
              >
                <Heart
                  className={`size-5 transition-transform ${fav ? "scale-110 text-[#ff4d6d]" : ""}`}
                  fill={fav ? "currentColor" : "none"}
                />
              </button>
            )}
            {canCompare && (
              <button
                onClick={() => {
                  setInfo(false)
                  setCompare(photoKey(current))
                }}
                aria-label={`Compare with v${history[history.length - 2].version}`}
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-white/15"
              >
                <Columns2 className="size-4" />
                <span className="max-sm:hidden">Compare</span>
              </button>
            )}
            <button
              onClick={() => setInfo((v) => !v)}
              aria-label="Photo info"
              className={`flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 ${
                info ? "text-brand" : ""
              }`}
            >
              <Info className="size-5" />
            </button>
            {canDownload && <DownloadMenu photo={current} slug={slug} />}
          </div>
        </div>

        {photos.length > 1 && (
          <div className="bg-gradient-to-t from-black/75 via-black/30 to-transparent pb-[max(env(safe-area-inset-bottom),14px)] pt-10">
            <Scrubber photos={photos} index={index} active={shown} onPick={goTo} />
          </div>
        )}
      </div>

      <PhotoInfoPanel photo={current} open={info} onOpenChange={setInfo} />
    </>,
    layer,
  )
}

// Photos-style strip: the current frame opens to its real shape, the rest sit
// as slivers; drag it to scrub through the shoot.
function Scrubber({
  photos,
  index,
  active,
  onPick,
}: {
  photos: Photo[]
  index: number
  active: boolean
  onPick: (i: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const down = useRef(false)
  const lastTouch = useRef(0)
  const first = useRef(true)
  // a finger on the strip, or its momentum still coasting
  const userDriven = () => down.current || performance.now() - lastTouch.current < 200

  useEffect(() => {
    if (userDriven()) return
    const el = ref.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)
    el?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: first.current ? "auto" : "smooth",
    })
    first.current = false
  }, [index])

  const touched = (isDown?: boolean) => {
    if (isDown !== undefined) down.current = isDown
    lastTouch.current = performance.now()
  }

  const onScroll = () => {
    const strip = ref.current
    // our own smooth centring scrolls too — only a hand on it picks photos
    if (!strip || !userDriven()) return
    lastTouch.current = performance.now()
    const mid = strip.getBoundingClientRect().left + strip.clientWidth / 2
    let best = index
    let bestD = Infinity
    for (const c of strip.children) {
      const r = (c as HTMLElement).getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - mid)
      if (dist < bestD) {
        bestD = dist
        best = Number((c as HTMLElement).dataset.i)
      }
    }
    if (best !== index) onPick(best)
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      onPointerDown={() => touched(true)}
      onPointerUp={() => touched(false)}
      onPointerCancel={() => touched(false)}
      onWheel={() => touched()}
      className={`flex h-12 items-center gap-[2px] overflow-x-auto px-[50%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        active ? "pointer-events-auto" : ""
      }`}
    >
      {photos.map((p, i) => {
        const on = i === index
        const { w, h } = dims(p)
        const a = Math.min(Math.max(w / h, 0.55), 1.9)
        return (
          <button
            key={`${p.file_metadata.album_id}:${p.file_metadata.filename}`}
            data-i={i}
            onClick={() => onPick(i)}
            aria-label={`Photo ${i + 1}`}
            style={{ width: on ? Math.round(46 * a) : 22 }}
            className={`h-[46px] shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out ${
              on ? "mx-1 rounded-[3px] opacity-100" : "opacity-60 hover:opacity-90"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tileSrc(p)}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="size-full object-cover"
            />
          </button>
        )
      })}
    </div>
  )
}

// videos don't join the swipe set — they get a plain player
export function VideoViewer({
  photo,
  onClose,
  canDownload = true,
}: {
  photo: Photo | null
  onClose: () => void
  canDownload?: boolean
}) {
  useEffect(() => {
    if (!photo) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.documentElement.style.overflow = ""
    }
  }, [photo, onClose])

  if (!photo) return null
  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-center justify-center bg-black" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute left-3 top-[max(env(safe-area-inset-top),12px)] z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 sm:left-6 sm:top-5"
      >
        <X className="size-5" />
      </button>
      <video
        src={photo.image}
        poster={tileSrc(photo)}
        controls
        // locked videos still stream, but lose the browser's own download button
        controlsList={canDownload ? undefined : "nodownload"}
        onContextMenu={canDownload ? undefined : (e) => e.preventDefault()}
        autoPlay
        playsInline
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full"
      />
    </div>,
    document.body,
  )
}
