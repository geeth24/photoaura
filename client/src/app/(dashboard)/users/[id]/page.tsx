"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { apiFetch } from "@/lib/api"
import type { UserDetail, NotifyKind } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  Mail,
  ImageIcon,
  Download,
  Film,
  Sparkles,
  KeyRound,
} from "lucide-react"
import { toast } from "sonner"

const eyebrow =
  "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"

function lastLoginLabel(iso?: string | null) {
  if (!iso) return "Never logged in"
  return `Last seen ${new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`
}

type Action = {
  kind: NotifyKind
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}

const ACTIONS: Action[] = [
  { kind: "gallery_ready", label: "Gallery ready", hint: "Their photos are ready to view", icon: Sparkles },
  { kind: "new_download", label: "New download", hint: "A file is ready to download", icon: Download },
  { kind: "new_video", label: "New video", hint: "A video was added", icon: Film },
  { kind: "login_link", label: "Login link", hint: "Plain sign-in link", icon: KeyRound },
]

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<NotifyKind | null>(null)

  const fetchUser = useCallback(() => {
    apiFetch<UserDetail>(`/users/${id}`)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const notify = async (kind: NotifyKind) => {
    setSending(kind)
    try {
      const res = await apiFetch<{ to: string }>(`/users/${id}/notify`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      })
      toast.success(`Email sent to ${res.to}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send email")
    } finally {
      setSending(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-24 text-center">
        <p className="font-heading text-2xl text-text-primary">User not found</p>
        <Link
          href="/users"
          className="mt-6 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="size-3.5" /> Back to Users
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href="/users"
          className="group mb-4 flex items-center gap-4 text-text-muted transition-colors hover:text-text-primary"
        >
          <span className="block h-px w-12 bg-brand" />
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
            <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
            Users
          </span>
        </Link>
        <h1 className="font-heading text-[clamp(2rem,4vw,3rem)] leading-[0.95] tracking-tight text-text-primary">
          {user.full_name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-light text-text-secondary">{user.user_email}</span>
          <span className="border border-border-default px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
            {user.role || "client"}
          </span>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${
              user.last_login_at ? "text-text-faint" : "text-brand"
            }`}
          >
            {lastLoginLabel(user.last_login_at)}
          </span>
        </div>
      </motion.div>

      {/* email actions */}
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className={eyebrow}>Send email</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map((a) => (
            <button
              key={a.kind}
              onClick={() => notify(a.kind)}
              disabled={sending !== null}
              className="flex flex-col items-start gap-2 border border-border-subtle bg-surface-elevated p-4 text-left transition-colors hover:border-border-strong disabled:opacity-50"
            >
              <a.icon className="size-4 text-brand" />
              <span className="text-sm font-medium text-text-primary">
                {sending === a.kind ? "Sending…" : a.label}
              </span>
              <span className="text-[11px] text-text-muted">{a.hint}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-faint">
          Every email includes a one-click sign-in link for this client.
        </p>
      </section>

      {/* albums */}
      <DetailList
        icon={ImageIcon}
        label="Albums"
        empty="No album access"
        items={(user.albums ?? []).map((a) => ({
          key: a.id,
          href: `/albums/${a.slug}`,
          title: a.name,
          sub: `${a.image_count} photos`,
        }))}
      />

      {/* emails */}
      <DetailList
        icon={Mail}
        label="Emails"
        empty="No linked emails"
        items={(user.emails ?? []).map((e, i) => ({
          key: i,
          title: e.email,
          sub: [e.is_primary ? "Primary" : null, e.verified ? "Verified" : "Unverified"]
            .filter(Boolean)
            .join(" · "),
        }))}
      />

      {/* downloads */}
      <DetailList
        icon={Download}
        label="Downloads"
        empty="No downloads attached"
        items={(user.downloads ?? []).map((d) => ({
          key: d.id,
          title: d.filename,
          sub: `${(d.size / 1_000_000).toFixed(1)} MB`,
        }))}
      />

      {/* videos */}
      <DetailList
        icon={Film}
        label="Videos"
        empty="No videos"
        items={(user.videos ?? []).map((v) => ({
          key: v.id,
          title: v.title || `Video ${v.id}`,
          sub: "",
        }))}
      />
    </div>
  )
}

function DetailList({
  icon: Icon,
  label,
  empty,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  empty: string
  items: { key: React.Key; href?: string; title: string; sub: string }[]
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="block h-px w-12 bg-brand" />
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
          <Icon className="size-3" />
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-border-default px-4 py-6 text-center text-[12px] text-text-muted">
          {empty}
        </p>
      ) : (
        <div className="border-y border-border-subtle">
          {items.map((it) => {
            const inner = (
              <>
                <span className="truncate text-sm text-text-primary">{it.title}</span>
                {it.sub && (
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.15em] text-text-faint">
                    {it.sub}
                  </span>
                )}
              </>
            )
            return it.href ? (
              <Link
                key={it.key}
                href={it.href}
                className="flex items-center justify-between gap-4 border-b border-border-subtle py-3 last:border-b-0 hover:text-brand"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={it.key}
                className="flex items-center justify-between gap-4 border-b border-border-subtle py-3 last:border-b-0"
              >
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
