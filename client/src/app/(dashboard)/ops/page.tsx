"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react"
import { apiFetch } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, HardDrive, Database, Activity } from "lucide-react"

type Ops = {
  counts: {
    albums: number
    photos: number
    videos: number
    users: number
    people: number
    faces: number
  }
  storage: { media_bytes: number; deliverables_bytes: number; total_bytes: number }
  db_size_bytes: number
  services: Record<string, boolean>
}

function fmtBytes(n: number): string {
  if (!n) return "0 B"
  const u = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1)
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

const SERVICE_LABELS: Record<string, string> = {
  backend: "API",
  postgres: "Database",
  face_service: "Face service",
  cdn: "CDN",
}

export default function OpsPage() {
  const [ops, setOps] = useState<Ops | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      setOps(await apiFetch<Ops>("/admin/ops"))
    } catch {
      setOps(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000) // refresh health every 30s
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <div className="mb-4 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              System
            </span>
          </div>
          <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
            Ops
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            Storage, content, and live service health.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </motion.div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !ops ? (
        <div className="border border-dashed border-destructive/40 py-16 text-center">
          <p className="font-heading text-xl text-text-primary">Couldn&apos;t load ops</p>
          <p className="mt-1 text-sm text-text-muted">
            The API may be down — that&apos;s itself a signal.
          </p>
        </div>
      ) : (
        <>
          {/* services */}
          <section className="space-y-4">
            <Eyebrow icon={Activity}>Services</Eyebrow>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(ops.services).map(([key, up]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border border-border-subtle bg-surface-elevated px-4 py-4"
                >
                  <span className="text-sm text-text-primary">
                    {SERVICE_LABELS[key] || key}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        up ? "bg-emerald-400" : "bg-destructive"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium uppercase tracking-[0.2em] ${
                        up ? "text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {up ? "Up" : "Down"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* storage */}
          <section className="space-y-4">
            <Eyebrow icon={HardDrive}>Storage</Eyebrow>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Total tracked (S3)" value={fmtBytes(ops.storage.total_bytes)} big />
              <Stat label="Media (photos + video)" value={fmtBytes(ops.storage.media_bytes)} />
              <Stat label="Deliverables" value={fmtBytes(ops.storage.deliverables_bytes)} />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-text-faint">
              <Database className="size-3.5" />
              Database size: {fmtBytes(ops.db_size_bytes)}
            </div>
          </section>

          {/* content counts */}
          <section className="space-y-4">
            <Eyebrow icon={Activity}>Content</Eyebrow>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Albums" value={ops.counts.albums.toLocaleString()} />
              <Stat label="Photos" value={ops.counts.photos.toLocaleString()} />
              <Stat label="Videos" value={ops.counts.videos.toLocaleString()} />
              <Stat label="Users" value={ops.counts.users.toLocaleString()} />
              <Stat label="People" value={ops.counts.people.toLocaleString()} />
              <Stat label="Faces" value={ops.counts.faces.toLocaleString()} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Eyebrow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: string
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="block h-px w-8 bg-brand" />
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
        <Icon className="size-3" />
        {children}
      </span>
    </div>
  )
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="border border-border-subtle bg-surface-elevated px-4 py-5">
      <div
        className={`font-heading tracking-tight text-text-primary ${
          big ? "text-3xl text-brand" : "text-2xl"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
        {label}
      </div>
    </div>
  )
}
