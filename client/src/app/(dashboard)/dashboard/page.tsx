"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Album, DashboardStats, Face } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { FolderOpen, Users, Images, Smile, ArrowRight, ImageOff } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [faces, setFaces] = useState<Face[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    Promise.allSettled([
      apiFetch<DashboardStats>("/dashboard/"),
      apiFetch<Face[]>("/faces"),
      apiFetch<Album[]>(`/albums/?user_id=${user.id}`),
    ])
      .then(([s, f, a]) => {
        if (s.status === "fulfilled") setStats(s.value)
        if (f.status === "fulfilled") setFaces(f.value)
        if (a.status === "fulfilled") setAlbums(a.value)
      })
      .finally(() => setLoading(false))
  }, [user])

  // first name for a warmer greeting, falls back gracefully
  const firstName = user?.full_name?.trim().split(" ")[0]

  const sharedCount = albums.filter((a) => a.shared).length
  const recentAlbums = albums.slice(0, 4)
  const largest = [...albums].sort((a, b) => b.image_count - a.image_count).slice(0, 5)
  const maxCount = largest[0]?.image_count || 1

  const statCards = [
    { label: "Albums", icon: FolderOpen, value: stats?.albums, note: sharedCount ? `${sharedCount} shared` : null },
    { label: "Photos", icon: Images, value: stats?.photos, note: null },
    { label: "Faces", icon: Smile, value: faces.length, note: null },
    { label: "Users", icon: Users, value: stats?.users, note: null },
  ]

  return (
    <div className="space-y-12">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Overview
          </span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        </h1>
        <p className="mt-3 text-sm font-light text-text-secondary">
          {loading
            ? "Gathering your studio at a glance…"
            : "A quiet snapshot of your studio."}
        </p>
      </motion.div>

      {/* stats */}
      <div className="grid gap-px overflow-hidden border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, icon: Icon, value, note }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: Math.min(i * 0.08, 0.4),
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group relative flex flex-col justify-between bg-surface-elevated p-8 transition-colors hover:bg-surface-hover"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
                {label}
              </span>
              <Icon className="size-4 text-text-faint transition-colors group-hover:text-brand" />
            </div>

            <div className="mt-10">
              {loading ? (
                <Skeleton className="h-12 w-24" />
              ) : (
                <>
                  <p className="font-heading text-5xl leading-none tracking-tight text-text-primary">
                    {value?.toLocaleString() ?? "—"}
                  </p>
                  {note && (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-brand/70">
                      {note}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* recent albums + largest collections */}
      {!loading && albums.length > 0 && (
        <div className="grid gap-10 lg:grid-cols-3">
          {/* recent albums */}
          <section className="space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="block h-px w-8 bg-brand" />
                <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                  Recent Albums
                </span>
              </div>
              <Link
                href="/albums"
                className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary"
              >
                View all
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {recentAlbums.map((album) => {
                const cover = album.album_photos?.[0]
                return (
                  <Link key={album.slug} href={`/albums/${album.slug}`} className="group block">
                    <div className="relative aspect-[4/3] w-full overflow-hidden border border-border-subtle bg-surface-elevated">
                      {cover ? (
                        <Image
                          src={cover.compressed_image}
                          alt={album.album_name}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          sizes="(max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-text-faint">
                          <ImageOff className="size-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/15 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className="line-clamp-1 font-heading text-lg leading-tight tracking-tight text-text-primary">
                          {album.album_name}
                        </h3>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-text-muted">
                          {album.image_count} {album.image_count === 1 ? "photo" : "photos"}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* largest collections */}
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="block h-px w-8 bg-brand" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                Largest Collections
              </span>
            </div>

            <div className="space-y-5">
              {largest.map((album, i) => (
                <Link key={album.slug} href={`/albums/${album.slug}`} className="group block">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2.5">
                      <span className="text-[11px] tabular-nums text-text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate text-sm text-text-secondary transition-colors group-hover:text-text-primary">
                        {album.album_name}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums text-text-muted">
                      {album.image_count}
                    </span>
                  </div>
                  <div className="mt-2 h-0.5 w-full bg-border-subtle">
                    <div
                      className="h-0.5 bg-brand transition-all duration-500 group-hover:bg-brand-light"
                      style={{ width: `${(album.image_count / maxCount) * 100}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
