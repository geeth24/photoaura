"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import {
  ArrowLeft,
  CalendarCheck,
  Download,
  Heart,
  House,
  Images,
  LogOut,
  Play,
  ReceiptText,
  Share2,
  UserCircle,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ALBUM, MOMENTS, PEOPLE, PHOTOS, faceSrc, momentRange, type PersonId } from "@/lib/demo"
import { Tile, chipActive, chipButton, chipIdle } from "@/components/demo-ui"

type Scope = "highlights" | "all" | "moments"

const grid = "grid grid-cols-3 gap-[2px] sm:grid-cols-4 sm:gap-[3px] lg:grid-cols-5"
const tabs = [
  { label: "Home", icon: House },
  { label: "Galleries", icon: Images, active: true },
  { label: "Bookings", icon: CalendarCheck },
  { label: "Invoices", icon: ReceiptText },
]

// a client's view of a delivered gallery, running on the page with made-up data
export function AlbumDemo() {
  const [scope, setScope] = useState<Scope>("highlights")
  const [face, setFace] = useState<PersonId | null>(null)
  const [picks, setPicks] = useState<Set<string>>(() => new Set(["wed-bluff", "wed-veil", "wed-mother"]))

  const scoped = useMemo(() => {
    const byFace = face ? PHOTOS.filter((p) => p.people.includes(face)) : PHOTOS
    return scope === "highlights" ? byFace.filter((p) => p.highlight) : byFace
  }, [scope, face])

  const counts = {
    highlights: PHOTOS.filter((p) => p.highlight).length,
    all: PHOTOS.length,
    moments: MOMENTS.length,
  }

  const togglePick = (id: string) =>
    setPicks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="relative overflow-hidden border border-border-default bg-surface shadow-[0_40px_120px_-40px_rgba(0,0,0,0.45)]">
      {/* the client app's top bar */}
      <div className="flex h-12 items-center justify-between gap-6 border-b border-border-subtle bg-surface/80 px-4 backdrop-blur-xl sm:h-14 sm:px-6">
        <div className="flex h-full items-center gap-6 lg:gap-10">
          <span className="flex items-center gap-2.5">
            <Image src="/logo-color.png" alt="" width={22} height={22} />
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-primary sm:text-[11px]">
              PhotoAura
            </span>
          </span>
          <nav className="hidden h-full items-stretch md:flex" aria-hidden>
            {tabs.map((t) => (
              <span
                key={t.label}
                className={cn(
                  "relative flex items-center px-3.5 text-[10px] font-medium uppercase tracking-[0.25em]",
                  t.active ? "text-text-primary" : "text-text-muted",
                )}
              >
                {t.label}
                {t.active && <span className="absolute inset-x-3.5 -bottom-px h-px bg-brand" />}
              </span>
            ))}
          </nav>
        </div>
        <span className="flex items-center gap-1 text-text-muted" aria-hidden>
          <UserCircle className="hidden size-[17px] md:block" />
          <LogOut className="ml-2 size-[16px]" />
        </span>
      </div>

      <div className="h-[620px] overflow-y-auto overscroll-contain px-4 pb-24 pt-6 sm:h-[700px] sm:px-8 sm:pt-8 md:pb-10 lg:h-[760px] lg:px-12">
        <div className="space-y-9">
          {/* header */}
          <div>
            <span className="mb-4 flex items-center gap-4 text-text-muted">
              <span className="block h-px w-12 bg-brand" />
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
                <ArrowLeft className="size-3" />
                Albums
              </span>
            </span>
            <h3 className="font-heading text-[clamp(2rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
              {ALBUM.name}
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-text-muted">{PHOTOS.length} photos</span>
              <span className="border border-border-default px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
                Shared
              </span>
              <span className={cn(chipButton, chipIdle)}>
                <Heart className="size-3" />
                {picks.size} picks
              </span>
              <span className={cn(chipButton, chipIdle)}>
                <Download className="size-3" />
                Download all
              </span>
              <span className={cn(chipButton, chipIdle)}>
                <Share2 className="size-3" />
                Share
              </span>
            </div>
          </div>

          {/* people */}
          <section className="space-y-4">
            <div className="flex items-center gap-4 text-text-muted">
              <span className="block h-px w-12 bg-brand" />
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
                <Users className="size-3" />
                People
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">{PEOPLE.length}</span>
            </div>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setFace(null)}
                aria-pressed={face === null}
                className={cn(
                  "flex size-16 shrink-0 items-center justify-center border text-[10px] font-medium uppercase tracking-[0.15em] transition-colors sm:size-20",
                  face === null
                    ? "border-brand text-brand"
                    : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text-primary",
                )}
              >
                All
              </button>
              {PEOPLE.map((p) => {
                const active = face === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFace(active ? null : p.id)}
                    aria-pressed={active}
                    aria-label={`Show photos of ${p.name}`}
                    className="group shrink-0 space-y-1.5 text-center"
                  >
                    <span
                      className={cn(
                        "relative block size-16 overflow-hidden border transition-all sm:size-20",
                        active
                          ? "border-brand shadow-[0_0_30px_rgba(0,166,251,0.25)]"
                          : "border-border-subtle group-hover:border-border-strong",
                      )}
                    >
                      <Image
                        src={faceSrc(p.id)}
                        alt=""
                        fill
                        sizes="80px"
                        className={cn(
                          "object-cover transition-all duration-500",
                          active ? "brightness-110" : "brightness-90 group-hover:brightness-100",
                        )}
                      />
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.15em] text-text-muted">{p.name}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* highlights / all / moments */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Gallery view">
            {(["highlights", "all", "moments"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                aria-pressed={scope === id}
                className={cn(chipButton, scope === id ? chipActive : chipIdle)}
              >
                {id === "highlights" ? "Highlights" : id === "all" ? "All" : "Moments"}
                <span className="text-text-faint">{counts[id]}</span>
              </button>
            ))}
          </div>

          {/* the album's reels sit under the view chips, as in the app */}
          <section aria-label="Reels" className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="block h-px w-8 bg-brand" />
              <h4 className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">Reels</h4>
              <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">2</span>
            </div>
            <div className="flex gap-3">
              {[
                { poster: "/demo/reel-poster.webp", box: "aspect-[9/16]", label: "vertical" },
                { poster: "/demo/reel-wide-poster.webp", box: "aspect-video", label: "horizontal" },
              ].map((r) => (
                <a
                  key={r.label}
                  href="#reels"
                  aria-label={`See the ${r.label} reel`}
                  className={cn("group relative h-32 shrink-0 overflow-hidden bg-surface-elevated sm:h-40", r.box)}
                >
                  <Image src={r.poster} alt="" fill sizes="400px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white">
                    <Play className="size-3" fill="currentColor" />
                    0:20
                  </span>
                </a>
              ))}
            </div>
          </section>

          {scoped.length === 0 ? (
            <p className="border border-dashed border-border-default py-16 text-center text-sm font-light text-text-muted">
              No highlights with {PEOPLE.find((p) => p.id === face)?.name} yet. Try All.
            </p>
          ) : scope === "moments" ? (
            <div className="space-y-8">
              {MOMENTS.map((m) => {
                const photos = scoped.filter((p) => p.moment === m.key)
                if (!photos.length) return null
                return (
                  <section key={m.key} aria-label={m.label}>
                    <header className="sticky -top-6 z-10 -mx-4 mb-3 flex items-baseline justify-between gap-4 border-b border-border-subtle bg-surface/90 px-4 py-2.5 backdrop-blur-xl sm:-top-8 sm:mx-0 sm:px-0">
                      <h4 className="flex min-w-0 items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
                        <span className="block h-px w-6 shrink-0 bg-brand" />
                        <span className="truncate">{m.label}</span>
                      </h4>
                      <p className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-text-faint">
                        {momentRange(photos)}
                        <span className="px-1.5">·</span>
                        {photos.length}
                      </p>
                    </header>
                    <div className={cn(grid, "-mx-4 sm:mx-0")}>
                      {photos.map((p) => (
                        <Tile key={p.id} photo={p} picked={picks.has(p.id)} onPick={() => togglePick(p.id)} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className={cn(grid, "-mx-4 sm:mx-0")}>
              {scoped.map((p) => (
                <Tile key={p.id} photo={p} picked={picks.has(p.id)} onPick={() => togglePick(p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* there's more below: the frame scrolls like the real page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-16 bg-gradient-to-t from-surface to-transparent md:block" />

      {/* phones get the app's bottom tab bar */}
      <div className="absolute inset-x-0 bottom-0 flex border-t border-border-subtle bg-surface/90 backdrop-blur-xl md:hidden" aria-hidden>
        {[...tabs, { label: "Profile", icon: UserCircle }].map((t) => (
          <span
            key={t.label}
            className={cn(
              "flex h-14 flex-1 flex-col items-center justify-center gap-1",
              "active" in t && t.active ? "text-brand" : "text-text-muted",
            )}
          >
            <t.icon className="size-[18px]" />
            <span className="text-[8px] font-medium uppercase tracking-[0.18em]">{t.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
