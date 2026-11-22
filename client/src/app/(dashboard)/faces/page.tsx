"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { Check, Search, UserRound } from "lucide-react"
import { useDocumentTitle } from "@/lib/use-document-title"
import { apiFetch } from "@/lib/api"
import type { Album, Face } from "@/lib/types"
import { plural } from "@/lib/format"
import { ease, FilterTabs, PageHeader, SectionLabel } from "@/components/page-header"
import { FaceChip, FaceDetail, saveFaceName } from "@/components/face-detail"
import { Skeleton } from "@/components/ui/skeleton"

type Sort = "photos" | "name"

const photosOf = (f: Face) => f.photo_links?.length ?? 0
const albumsOf = (f: Face) => new Set((f.photo_links ?? []).map((l) => l.album_id))

export default function FacesPage() {
  useDocumentTitle("Faces")
  const [faces, setFaces] = useState<Face[] | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [selected, setSelected] = useState<Face | null>(null)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("photos")

  const fetchFaces = useCallback(() => {
    apiFetch<Face[]>("/faces").then(setFaces).catch(() => setFaces([]))
  }, [])

  useEffect(() => {
    fetchFaces()
    apiFetch<Album[]>("/albums/").then(setAlbums).catch(() => setAlbums([]))
  }, [fetchFaces])

  const albumById = useMemo(() => new Map(albums.map((a) => [a.album_id, a])), [albums])
  const unnamed = useMemo(() => (faces ?? []).filter((f) => !f.name).sort((a, b) => photosOf(b) - photosOf(a)), [faces])
  const named = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (faces ?? [])
      .filter((f) => f.name && (!q || f.name.toLowerCase().includes(q)))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : photosOf(b) - photosOf(a)))
  }, [faces, query, sort])

  if (selected)
    return (
      <FaceDetail
        key={selected.external_id}
        face={selected}
        albums={albumById}
        onBack={() => setSelected(null)}
        onChanged={fetchFaces}
      />
    )

  const albumCount = new Set((faces ?? []).flatMap((f) => [...albumsOf(f)])).size
  const subtitle = faces
    ? `${plural(faces.length, "person", "people")} recognized across ${plural(albumCount, "album")}${unnamed.length ? ` · ${unnamed.length} still unnamed` : ""}`
    : "Loading people…"

  return (
    <div className="space-y-12">
      <PageHeader eyebrow="People" title="Faces" subtitle={subtitle} />

      {faces == null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full" />
          ))}
        </div>
      ) : faces.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
          <UserRound className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">No faces yet</p>
          <p className="mt-1 text-sm font-light text-text-muted">People appear here once an album with face detection is processed.</p>
        </div>
      ) : (
        <>
          {unnamed.length > 0 && (
            <section className="space-y-5">
              <SectionLabel aside={<span className="text-[10px] uppercase tracking-[0.3em] text-text-faint">{unnamed.length} to go</span>}>
                Name these people
              </SectionLabel>
              <p className="-mt-2 text-sm font-light text-text-muted">
                Names show on the people filter inside each album, for you and your clients; unnamed faces show only a photo count.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {unnamed.map((f) => (
                  <UnnamedCard key={f.external_id} face={f} albums={albumById} onOpen={() => setSelected(f)} onNamed={fetchFaces} />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-5">
            <SectionLabel>Everyone</SectionLabel>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-border-default bg-surface-elevated px-3 sm:max-w-xs">
                <Search className="size-3.5 shrink-0 text-text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a person"
                  className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none"
                />
              </label>
              <FilterTabs
                value={sort}
                onChange={setSort}
                options={[
                  { key: "photos", label: "Most photos" },
                  { key: "name", label: "A–Z" },
                ]}
              />
            </div>
            {named.length === 0 ? (
              <p className="border border-dashed border-border-default py-10 text-center text-sm font-light text-text-muted">
                {query ? "Nobody by that name." : "Name someone above and they'll show up here."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {named.map((f, i) => (
                  <motion.button
                    key={f.external_id}
                    onClick={() => setSelected(f)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: Math.min(i * 0.04, 0.3), ease }}
                    className="group block text-left"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden border border-border-subtle bg-surface-elevated">
                      {f.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.image_url}
                          alt={f.name}
                          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className="line-clamp-1 font-heading text-xl leading-tight tracking-tight text-text-primary">{f.name}</h3>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-text-muted">
                          {plural(photosOf(f), "photo")} · {plural(albumsOf(f).size, "album")}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function UnnamedCard({
  face,
  albums,
  onOpen,
  onNamed,
}: {
  face: Face
  albums: Map<number | undefined, Album>
  onOpen: () => void
  onNamed: () => void
}) {
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const firstAlbum = albums.get(face.photo_links?.[0]?.album_id)?.album_name

  const save = async () => {
    const name = draft.trim()
    if (!name) return
    setSaving(true)
    try {
      await saveFaceName(face.external_id, name)
      onNamed()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-3 border border-border-subtle bg-surface-elevated p-3">
      <button onClick={onOpen} aria-label="See their photos" className="shrink-0">
        <FaceChip src={face.image_url} name={null} className="size-20 transition-opacity hover:opacity-80" />
      </button>
      <form
        className="flex min-w-0 flex-1 flex-col justify-between gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <p className="truncate text-[10px] uppercase tracking-[0.15em] text-text-faint">
          {plural(photosOf(face), "photo")}
          {firstAlbum && ` · ${firstAlbum}`}
        </p>
        <div className="flex items-center gap-1.5 border-b border-border-default focus-within:border-brand">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Who is this?"
            disabled={saving}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            aria-label="Save name"
            className="flex size-7 items-center justify-center text-brand transition-opacity disabled:opacity-30"
          >
            <Check className="size-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
