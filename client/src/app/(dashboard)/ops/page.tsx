"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { useDocumentTitle } from "@/lib/use-document-title"
import { apiFetch } from "@/lib/api"
import { fmtBytes, plural } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { AppUpdateSettings } from "@/components/app-update-settings"
import { microLabel, PageHeader, quietButton, SectionLabel } from "@/components/page-header"
import { cn } from "@/lib/utils"

type Ops = {
  counts: { albums: number; photos: number; videos: number; users: number; people: number; faces: number }
  storage: { media_bytes: number; deliverables_bytes: number; total_bytes: number }
  db_size_bytes: number
  services: Record<string, boolean>
  // older servers don't send it
  top_albums?: { slug: string; name: string; bytes: number; photos: number; videos: number }[]
}

// what each service does, and what breaks while it's down
const SERVICES: Record<string, { label: string; does: string; down: string }> = {
  backend: { label: "API", does: "Answers the dashboard, the apps and client galleries", down: "Nothing loads for anyone." },
  postgres: { label: "Database", does: "Albums, bookings, accounts and payments", down: "Pages fail to load and changes don't save." },
  face_service: { label: "Face service", does: "Finds and groups faces in new uploads", down: "New uploads aren't grouped by face until it's back. Everything else works." },
  cdn: { label: "CDN", does: "Delivers every photo and thumbnail", down: "Photos don't load in galleries or the apps." },
}

const ago = (d: Date | null, now: number) => {
  if (!d) return ""
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000))
  return s < 10 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
}

export default function OpsPage() {
  useDocumentTitle("Ops")
  const [ops, setOps] = useState<Ops | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [checked, setChecked] = useState<Date | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      setOps(await apiFetch<Ops>("/admin/ops"))
    } catch {
      setOps(null)
    } finally {
      setChecked(new Date())
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const poll = setInterval(load, 30000)
    const tick = setInterval(() => setNow(Date.now()), 5000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

  const down = ops ? Object.entries(ops.services).filter(([, up]) => !up).map(([k]) => k) : []

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="System"
        title="Ops"
        subtitle="Live health, storage and app versions. Health checks again every 30 seconds."
        actions={
          <button onClick={() => load(true)} disabled={refreshing} className={quietButton}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {checked ? `Checked ${ago(checked, now)}` : "Refresh"}
          </button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !ops ? (
        <StatusBand tone="down" title="Can't reach the API" detail="The dashboard, apps and galleries are likely down too. Refresh in a minute, then check the server." />
      ) : (
        <>
          <section className="space-y-4">
            {down.length === 0 ? (
              <StatusBand tone="up" title="Everything is running" detail={`All ${Object.keys(ops.services).length} services answered the last check.`} />
            ) : (
              <StatusBand
                tone="down"
                title={`${down.map((k) => SERVICES[k]?.label ?? k).join(" and ")} ${down.length === 1 ? "is" : "are"} down`}
                detail={down.map((k) => SERVICES[k]?.down).filter(Boolean).join(" ")}
              />
            )}
            <ul className="grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2">
              {Object.entries(ops.services).map(([key, up]) => (
                <li key={key} className="flex items-start justify-between gap-4 bg-surface-elevated px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">{SERVICES[key]?.label ?? key}</p>
                    <p className="mt-0.5 text-[12px] font-light text-text-muted">{SERVICES[key]?.does}</p>
                  </div>
                  <span className={cn("flex shrink-0 items-center gap-2 pt-0.5 text-[10px] font-medium uppercase tracking-[0.2em]", up ? "text-success" : "text-destructive")}>
                    <span className={cn("size-2 rounded-full", up ? "bg-success" : "bg-destructive")} />
                    {up ? "Up" : "Down"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <Storage ops={ops} />

          <section className="space-y-4">
            <SectionLabel>Library</SectionLabel>
            <dl className="grid grid-cols-2 gap-px border border-border-subtle bg-border-subtle sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["Albums", ops.counts.albums],
                  ["Photos", ops.counts.photos],
                  ["Videos", ops.counts.videos],
                  ["Accounts", ops.counts.users],
                  ["People", ops.counts.people],
                  ["Faces detected", ops.counts.faces],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="bg-surface-elevated px-4 py-4">
                  <dt className={microLabel}>{label}</dt>
                  <dd className="mt-2 font-heading text-2xl leading-none tracking-tight text-text-primary">{n.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}

      <AppUpdateSettings />
    </div>
  )
}

function StatusBand({ tone, title, detail }: { tone: "up" | "down"; title: string; detail: string }) {
  const up = tone === "up"
  return (
    <div className={cn("grain flex items-center gap-5 border px-6 py-6", up ? "border-success/30 bg-success/5" : "border-destructive/40 bg-destructive/10")}>
      <span className="relative flex size-3 shrink-0">
        {up && <span className="absolute inset-0 animate-ping rounded-full bg-success/50 [animation-duration:2.4s]" />}
        <span className={cn("relative size-3 rounded-full", up ? "bg-success" : "bg-destructive")} />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-2xl leading-tight tracking-tight text-text-primary sm:text-3xl">{title}</p>
        <p className="mt-1 text-sm font-light text-text-secondary">{detail}</p>
      </div>
    </div>
  )
}

function Storage({ ops }: { ops: Ops }) {
  const { media_bytes, deliverables_bytes, total_bytes } = ops.storage
  const mediaPct = total_bytes ? (media_bytes / total_bytes) * 100 : 0
  const top = ops.top_albums ?? []
  const biggest = top[0]?.bytes || 1
  return (
    <section className="space-y-4">
      <SectionLabel>Storage</SectionLabel>
      <div className="grid gap-px border border-border-subtle bg-border-subtle lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-6 bg-surface-elevated p-6">
          <div>
            <p className={microLabel}>Tracked in S3</p>
            <p className="mt-2 font-heading text-5xl leading-none tracking-tight text-text-primary">{fmtBytes(total_bytes)}</p>
          </div>
          <div className="space-y-3">
            <div className="flex h-2 w-full overflow-hidden bg-surface">
              <span className="h-full bg-brand" style={{ width: `${mediaPct}%` }} />
              <span className="h-full bg-brand/35" style={{ width: `${100 - mediaPct}%` }} />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <dt className="flex items-center gap-2 text-text-muted">
                  <span className="size-2 bg-brand" />
                  Photos and video
                </dt>
                <dd className="mt-1 text-text-primary">{fmtBytes(media_bytes)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-text-muted">
                  <span className="size-2 bg-brand/35" />
                  Client downloads
                </dt>
                <dd className="mt-1 text-text-primary">{fmtBytes(deliverables_bytes)}</dd>
              </div>
            </dl>
          </div>
          <p className="border-t border-border-subtle pt-4 text-[12px] font-light text-text-muted">
            Database {fmtBytes(ops.db_size_bytes)}, not counted above.
          </p>
        </div>

        <div className="bg-surface-elevated p-6">
          <p className={cn(microLabel, "mb-4")}>Largest albums</p>
          {top.length === 0 ? (
            <p className="text-sm font-light text-text-muted">The server doesn&apos;t report per-album sizes yet.</p>
          ) : (
            <ol className="space-y-4">
              {top.map((a) => (
                <li key={a.slug}>
                  <Link href={`/albums/${a.slug}`} className="group block">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-text-secondary transition-colors group-hover:text-text-primary">{a.name}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-text-primary">{fmtBytes(a.bytes)}</span>
                    </div>
                    <div className="mt-1.5 h-0.5 w-full bg-border-subtle">
                      <div className="h-0.5 bg-brand transition-colors group-hover:bg-brand-light" style={{ width: `${(a.bytes / biggest) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-text-faint">
                      {plural(a.photos, "photo")}
                      {a.videos ? ` · ${plural(a.videos, "video")}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
