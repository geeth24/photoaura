"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ImageOff } from "lucide-react"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import { isVideo, type Album, type Photo } from "@/lib/types"
import { takenAt } from "@/lib/photo-time"
import { plural } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlbumOptions } from "@/components/album-options"
import { PhotoGrid } from "@/components/photo-grid"
import { usePhotoViewer } from "@/hooks/use-photo-viewer"
import { FilterTabs, PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

type Kind = "all" | "photos" | "videos"
type Shape = "any" | "portrait" | "landscape"
type Day = { key: string; date: Date | null; photos: Photo[]; albums: number[] }

// roughly this many tiles go on the page at first; more load as you scroll
const PAGE_TILES = 240

const dayLabel = (d: Date | null) =>
  d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "No capture date"
const monthLabel = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Undated")

function dayOf(p: Photo) {
  const t = takenAt(p) ?? (p.file_metadata.upload_date ? new Date(p.file_metadata.upload_date) : null)
  return t && !Number.isNaN(t.getTime()) ? new Date(t.getFullYear(), t.getMonth(), t.getDate()) : null
}

// days keep the API's newest-first order
function groupByDay(photos: Photo[]): Day[] {
  const days = new Map<string, Day>()
  for (const p of photos) {
    const d = dayOf(p)
    const key = d ? d.toDateString() : "undated"
    let day = days.get(key)
    if (!day) {
      day = { key, date: d, photos: [], albums: [] }
      days.set(key, day)
    }
    day.photos.push(p)
    if (!day.albums.includes(p.file_metadata.album_id)) day.albums.push(p.file_metadata.album_id)
  }
  return [...days.values()]
}

function firstPage(days: Day[]) {
  let tiles = 0
  let n = 0
  while (n < days.length && tiles < PAGE_TILES) tiles += days[n++].photos.length
  return Math.max(n, 1)
}

export default function PhotosPage() {
  useDocumentTitle("All Photos")
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [album, setAlbum] = useState("all")
  const [kind, setKind] = useState<Kind>("all")
  const [shape, setShape] = useState<Shape>("any")
  // how many days are on the page, remembered per filtered list
  const [page, setPage] = useState<{ days: Day[] | null; n: number }>({ days: null, n: 1 })
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    apiFetch<Photo[]>("/photos/").then(setPhotos).catch(() => setPhotos([]))
    apiFetch<Album[]>("/albums/").then(setAlbums).catch(() => setAlbums([]))
  }, [user])

  const albumById = useMemo(() => new Map(albums.map((a) => [a.album_id, a])), [albums])
  const filtered = useMemo(
    () =>
      (photos ?? []).filter((p) => {
        if (album !== "all" && String(p.file_metadata.album_id) !== album) return false
        if (kind === "photos" && isVideo(p)) return false
        if (kind === "videos" && !isVideo(p)) return false
        return shape === "any" || p.file_metadata.orientation === shape
      }),
    [photos, album, kind, shape],
  )
  const days = useMemo(() => groupByDay(filtered), [filtered])
  const videoCount = useMemo(() => (photos ?? []).filter(isVideo).length, [photos])
  const { open: openPhoto, viewers } = usePhotoViewer(filtered)

  const shown = page.days === days ? page.n : firstPage(days)
  const setShown = (next: (n: number) => number) => setPage({ days, n: next(shown) })

  // keep adding days while the end of the list is in view
  useEffect(() => {
    const el = sentinel.current
    if (!el || shown >= days.length) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setPage({ days, n: Math.min(shown + firstPage(days.slice(shown)), days.length) })
      },
      { rootMargin: "1200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown, days])

  const jumpTo = (i: number) => {
    setShown((n) => Math.max(n, i + 1))
    requestAnimationFrame(() =>
      document.getElementById(`day-${days[i].key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    )
  }

  const albumCount = new Set((photos ?? []).map((p) => p.file_metadata.album_id)).size
  const subtitle =
    photos == null
      ? "Loading the library…"
      : `${plural(photos.length - videoCount, "photo")}${videoCount ? ` and ${plural(videoCount, "video")}` : ""} from ${plural(albumCount, "album")}, newest shoot first.`

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Library" title="Photos" subtitle={subtitle} />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={album} onValueChange={(v) => setAlbum(String(v ?? "all"))}>
          <SelectTrigger className="h-9 w-full min-w-52 bg-surface-elevated text-[12px] sm:w-auto">
            <SelectValue>
              {(v) => (v === "all" || !v ? "All albums" : albumById.get(Number(v))?.album_name ?? "Album")}
            </SelectValue>
          </SelectTrigger>
          <AlbumOptions albums={albums} all="All albums" />
        </Select>
        {videoCount > 0 && (
          <FilterTabs
            value={kind}
            onChange={setKind}
            options={[
              { key: "all", label: "All" },
              { key: "photos", label: "Photos" },
              { key: "videos", label: "Videos", count: videoCount },
            ]}
          />
        )}
        <FilterTabs
          value={shape}
          onChange={setShape}
          options={[
            { key: "any", label: "Any shape" },
            { key: "portrait", label: "Portrait" },
            { key: "landscape", label: "Landscape" },
          ]}
        />
        {photos && filtered.length !== photos.length && (
          <span className="text-[10px] uppercase tracking-[0.25em] text-text-faint sm:ml-2">
            {plural(filtered.length, "match", "matches")}
          </span>
        )}
      </div>

      {photos == null ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px] grow" style={{ flexBasis: `${200 + (i % 3) * 80}px` }} />
          ))}
        </div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
          <ImageOff className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">
            {photos.length ? "Nothing matches these filters" : "No photos yet"}
          </p>
          <p className="mt-1 text-sm font-light text-text-muted">
            {photos.length ? "Try another album or shape." : "Upload photos to an album to see them here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[184px_minmax(0,1fr)]">
          <DayIndex days={days} albumById={albumById} onJump={jumpTo} />
          <div className="min-w-0 space-y-8">
            {days.slice(0, shown).map((d, i) => (
              <section key={d.key} id={`day-${d.key}`} className="scroll-mt-20" aria-label={dayLabel(d.date)}>
                <header className="sticky top-16 z-10 mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle bg-surface/90 py-2.5 backdrop-blur-xl">
                  <h2 className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
                    <span className="block h-px w-6 shrink-0 bg-brand" />
                    {dayLabel(d.date)}
                  </h2>
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[10px] uppercase tracking-[0.15em] text-text-faint">
                    {d.albums.map((id) => {
                      const a = albumById.get(id)
                      return a ? (
                        <Link key={id} href={`/albums/${a.slug}`} className="text-text-muted transition-colors hover:text-brand">
                          {a.album_name}
                        </Link>
                      ) : null
                    })}
                    <span>· {d.photos.length}</span>
                  </p>
                </header>
                <PhotoGrid photos={d.photos} onOpen={openPhoto} controls={i === 0} />
              </section>
            ))}
            {shown < days.length && <div ref={sentinel} className="h-px" />}
          </div>
        </div>
      )}

      {viewers}
    </div>
  )
}

// months down the side, each shoot day under its month
function DayIndex({ days, albumById, onJump }: { days: Day[]; albumById: Map<number | undefined, Album>; onJump: (i: number) => void }) {
  const months: { label: string; items: { day: Day; i: number }[] }[] = []
  days.forEach((day, i) => {
    const label = monthLabel(day.date)
    const last = months[months.length - 1]
    if (last?.label === label) last.items.push({ day, i })
    else months.push({ label, items: [{ day, i }] })
  })
  return (
    <nav aria-label="Jump to a day" className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-6 overflow-y-auto pr-2 [scrollbar-width:thin]">
        {months.map((m) => (
          <div key={m.label}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">{m.label}</p>
            <ul className="space-y-0.5 border-l border-border-subtle">
              {m.items.map(({ day, i }) => (
                <li key={day.key}>
                  <button
                    onClick={() => onJump(i)}
                    className={cn(
                      "group -ml-px flex w-full items-baseline gap-2.5 border-l border-transparent py-1 pl-3 text-left transition-colors hover:border-brand",
                    )}
                  >
                    <span className="w-5 shrink-0 font-heading text-base leading-none text-text-primary">
                      {day.date?.getDate() ?? "–"}
                    </span>
                    <span className="min-w-0 truncate text-[11px] font-light text-text-muted group-hover:text-text-primary">
                      {albumById.get(day.albums[0])?.album_name ?? "Album"}
                      {day.albums.length > 1 && ` +${day.albums.length - 1}`}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-text-faint">{day.photos.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
