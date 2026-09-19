"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { downloadAlbumZip } from "@/lib/download"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowUpRight,
  Download,
  FileArchive,
  Film,
  ImageIcon,
  Images,
  Loader2,
  Smartphone,
} from "lucide-react"

type HomeAlbum = {
  id: number
  name: string
  slug: string
  date: string | null
  location: string | null
  photo_count: number
  video_count: number
  cover: string | null
}

type HomeFile = {
  id: number
  filename: string
  size: number | null
  album_name: string | null
  created_at: string | null
  download_url?: string
}

type Home = {
  first_name: string | null
  albums: HomeAlbum[]
  files: HomeFile[]
  totals: { photos: number; videos: number; files: number }
}

const APP_STORE = "https://apps.apple.com/app/id6477320360"

const eyebrow =
  "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"

function fmtBytes(n: number | null) {
  if (!n) return ""
  const u = ["B", "KB", "MB", "GB"]
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i >= 2 ? 1 : 0)} ${u[i]}`
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

// a phone that can drop files into the camera roll, i.e. iOS/iPadOS Safari
function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    try {
      const ua = navigator.userAgent
      const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document)
      const probe = new File([new Blob(["x"])], "x.jpg", { type: "image/jpeg" })
      setPhone(ios && Boolean(navigator.canShare?.({ files: [probe] })))
    } catch {
      setPhone(false)
    }
  }, [])
  return phone
}

export function ClientHome() {
  useDocumentTitle("Your photos")
  const [home, setHome] = useState<Home | null>(null)
  const [loading, setLoading] = useState(true)
  const [zipping, setZipping] = useState<string | null>(null)
  const phone = useIsPhone()

  useEffect(() => {
    apiFetch<Home>("/me/home")
      .then(setHome)
      .catch(() => setHome(null))
      .finally(() => setLoading(false))
  }, [])

  const zip = async (slug: string) => {
    setZipping(slug)
    try {
      await downloadAlbumZip(slug)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the download")
    } finally {
      setZipping(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-10">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-14 w-80" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="aspect-[16/9] w-full" />
      </div>
    )
  }

  if (!home || home.albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
        <ImageIcon className="size-6 text-text-faint" />
        <p className="mt-4 font-heading text-2xl text-text-primary">Nothing here yet</p>
        <p className="mt-2 max-w-xs text-sm font-light text-text-muted">
          Your photographer hasn&apos;t shared a gallery with you yet. You&apos;ll
          get an email when they do.
        </p>
      </div>
    )
  }

  const { albums, files, totals } = home
  const [newest, ...rest] = albums
  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <div className="space-y-14">
      {/* welcome */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className={eyebrow}>Your photos</span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,5vw,3.75rem)] leading-[0.95] tracking-tight text-text-primary">
          {home.first_name ? `Hi ${home.first_name}.` : "Welcome."}
          <br />
          <span className="text-text-secondary">
            {albums.length === 1 ? "Your gallery is ready." : `${albums.length} galleries are ready.`}
          </span>
        </h1>

        {/* inventory */}
        <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          <Stat icon={Images} n={totals.photos} label="photos" />
          {totals.videos > 0 && <Stat icon={Film} n={totals.videos} label="videos" />}
          {totals.files > 0 && <Stat icon={FileArchive} n={totals.files} label="to download" />}
        </div>
      </motion.div>

      {/* newest gallery, hero-sized */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease }}
        className="space-y-5"
      >
        <Link
          href={`/albums/${newest.slug}`}
          className="group relative block aspect-[4/3] overflow-hidden bg-surface-elevated sm:aspect-[16/9]"
        >
          {newest.cover ? (
            <Image
              src={newest.cover}
              alt={newest.name}
              fill
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="size-8 text-text-faint" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 pt-24 sm:p-8">
            <div className="flex items-end justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/60">
                  {albums.length > 1 ? "Newest" : "Gallery"}
                  {newest.date ? ` · ${newest.date}` : ""}
                </p>
                <h2 className="mt-2 truncate font-heading text-3xl leading-tight tracking-tight text-white sm:text-4xl">
                  {newest.name}
                </h2>
                <p className="mt-1.5 text-[12px] text-white/60">
                  {plural(newest.photo_count, "photo")}
                  {newest.video_count > 0 && ` · ${plural(newest.video_count, "video")}`}
                </p>
              </div>
              <span className="flex size-11 shrink-0 items-center justify-center border border-white/30 text-white transition-colors group-hover:border-white group-hover:bg-white group-hover:text-black">
                <ArrowUpRight className="size-4" />
              </span>
            </div>
          </div>
        </Link>

        <GetPhotos album={newest} phone={phone} zipping={zipping === newest.slug} onZip={() => zip(newest.slug)} />
      </motion.section>

      {/* files sent to you */}
      {files.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className={eyebrow}>Ready to download</span>
          </div>
          <div className="border-y border-border-subtle">
            {files.map((f) => (
              <a
                key={f.id}
                href={f.download_url}
                className="group flex items-center justify-between gap-4 border-b border-border-subtle py-4 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-brand/10 text-brand">
                    <FileArchive className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary group-hover:text-brand">
                      {f.filename}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">
                      {[f.album_name, fmtBytes(f.size)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <Download className="size-4 shrink-0 text-text-faint transition-colors group-hover:text-brand" />
              </a>
            ))}
          </div>
          {phone && (
            <p className="text-[11px] text-text-faint">
              Zips open in the Files app on your phone. For your camera roll, use Save to Photos above.
            </p>
          )}
        </motion.section>
      )}

      {/* older galleries */}
      {rest.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24, ease }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className={eyebrow}>Earlier galleries</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <Link
                key={a.id}
                href={`/albums/${a.slug}`}
                className="group block border border-border-subtle bg-surface-elevated transition-colors hover:border-border-strong"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                  {a.cover ? (
                    <Image
                      src={a.cover}
                      alt={a.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="size-5 text-text-faint" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-medium text-text-primary">{a.name}</p>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {plural(a.photo_count, "photo")}
                    {a.video_count > 0 && ` · ${plural(a.video_count, "video")}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* the app */}
      <section className="flex flex-col gap-5 border border-border-subtle bg-surface-elevated p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center bg-brand/10 text-brand">
            <Smartphone className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary">PhotoAura for iPhone</p>
            <p className="mt-1 max-w-md text-[13px] font-light leading-relaxed text-text-secondary">
              Your galleries, favorites, and one-tap save to your camera roll — no
              browser needed. Sign in with the same email.
            </p>
          </div>
        </div>
        <a
          href={APP_STORE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 shrink-0 items-center justify-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          Get the app
          <ArrowUpRight className="size-3.5" />
        </a>
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  n,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  n: number
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 text-brand" />
      <span className="font-heading text-2xl leading-none text-text-primary">{n}</span>
      <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted">{label}</span>
    </div>
  )
}

// the one panel that answers "how do I get these?" — phone and desktop differ
function GetPhotos({
  album,
  phone,
  zipping,
  onZip,
}: {
  album: HomeAlbum
  phone: boolean
  zipping: boolean
  onZip: () => void
}) {
  const primary =
    "flex h-12 flex-1 items-center justify-center gap-2 bg-brand px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary disabled:opacity-60"
  const secondary =
    "flex h-12 flex-1 items-center justify-center gap-2 border border-border-default px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"

  return (
    <div className="border border-border-subtle bg-surface-elevated p-5 sm:p-6">
      <p className={eyebrow}>Get your photos</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {phone ? (
          <>
            <Link href={`/albums/${album.slug}#save`} className={primary}>
              <Smartphone className="size-3.5" />
              Save to Photos
            </Link>
            <Link href={`/albums/${album.slug}`} className={secondary}>
              <Images className="size-3.5" />
              Browse first
            </Link>
          </>
        ) : (
          <>
            <button onClick={onZip} disabled={zipping} className={primary}>
              {zipping ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              {zipping ? "Preparing…" : "Download all"}
            </button>
            <Link href={`/albums/${album.slug}`} className={secondary}>
              <Images className="size-3.5" />
              Browse the gallery
            </Link>
          </>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-text-faint">
        {phone
          ? "Save to Photos puts full-quality originals straight into your camera roll, twenty at a time."
          : `Download all gives you one zip of the ${plural(album.photo_count, "original")}. On your phone, open the gallery to save straight to your camera roll.`}
      </p>
    </div>
  )
}
