"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { ArrowRight, ArrowUpRight, CalendarClock, ImageOff, Layers, Lock, MapPin } from "lucide-react"
import { fmtTime, moneyShort, parseDay, STATUS_LABEL } from "@/lib/bookings"
import { daysFromToday, plural } from "@/lib/format"
import type { Album, Booking, BookingSummary } from "@/lib/types"
import { StatusChip } from "@/components/booking-status"
import { SendLinkButton } from "@/components/send-link-button"
import { ease, microLabel, SectionLabel } from "@/components/page-header"
import { cn } from "@/lib/utils"

const weekday = (d: Date, style: "short" | "long" = "short") => d.toLocaleDateString("en-US", { weekday: style })
const monthDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

// the next shoot, big, with the two weeks around it
export function NextShoot({
  summary,
  detail,
  shootDays,
}: {
  summary: BookingSummary | null
  detail: Booking | null
  shootDays: Set<string>
}) {
  const day = parseDay(summary?.event_date)
  const away = day ? daysFromToday(day) : null

  return (
    <section className="flex h-full flex-col border border-border-subtle bg-surface-elevated">
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
        <span className={microLabel}>Next shoot</span>
        {away != null && (
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-brand">
            {away === 0 ? "Today" : away === 1 ? "Tomorrow" : `In ${away} days`}
          </span>
        )}
      </div>

      {summary && day ? (
        <Link href={`/bookings/${summary.number}`} className="group grid flex-1 grid-cols-[auto_1fr] gap-5 p-5 sm:gap-6 sm:p-6">
          <div className="grain flex w-20 flex-col items-center justify-center self-start border border-border-default bg-surface py-4 text-center sm:w-28">
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-brand">{weekday(day)}</span>
            <span className="mt-1 font-heading text-5xl leading-none text-text-primary sm:text-6xl">{day.getDate()}</span>
            <span className="mt-1.5 text-[10px] uppercase tracking-[0.3em] text-text-muted">
              {day.toLocaleDateString("en-US", { month: "short" })}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
              {summary.event_type} · {summary.package_name}
            </p>
            <h3 className="mt-2 flex items-start gap-2 font-heading text-2xl leading-[1.05] tracking-tight text-text-primary sm:text-[1.85rem]">
              <span className="min-w-0">{summary.client.full_name}</span>
              <ArrowUpRight className="mt-1 size-4 shrink-0 text-brand opacity-0 transition-opacity group-hover:opacity-100" />
            </h3>
            <div className="mt-4 space-y-2 text-sm font-light text-text-secondary">
              {detail ? (
                <>
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-3.5 shrink-0 text-text-faint" />
                    {fmtTime(detail.event.start_time)} – {fmtTime(detail.event.end_time)}
                  </p>
                  {detail.event.location && (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0 text-text-faint" />
                      <span className="truncate">{detail.event.location}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-text-faint">Loading details…</p>
              )}
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-text-muted">
              {summary.next_payment
                ? `${summary.next_payment.label} ${moneyShort(summary.next_payment.amount_cents)}${summary.next_payment.due ? " · due now" : ""}`
                : STATUS_LABEL[summary.status]}
            </p>
          </div>
        </Link>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <CalendarClock className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-xl text-text-primary">Nothing on the calendar</p>
          <p className="mt-1 text-sm font-light text-text-muted">Booked shoots show up here.</p>
        </div>
      )}

      <TwoWeeks shootDays={shootDays} />
    </section>
  )
}

function TwoWeeks({ shootDays }: { shootDays: Set<string> }) {
  const today = new Date()
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i))
  return (
    <div className="border-t border-border-subtle px-6 py-4">
      <p className={cn(microLabel, "mb-3")}>Next two weeks</p>
      <ol className="grid grid-cols-7 gap-px bg-border-subtle sm:grid-cols-14">
        {days.map((d, i) => {
          const shoot = shootDays.has(d.toDateString())
          return (
            <li
              key={d.toDateString()}
              title={shoot ? "Shoot booked" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-center",
                shoot ? "bg-brand text-surface" : "bg-surface-elevated",
                i === 0 && !shoot && "bg-surface-hover",
              )}
            >
              <span className={cn("text-[9px] uppercase tracking-[0.15em]", shoot ? "text-surface/80" : "text-text-faint")}>
                {weekday(d).slice(0, 2)}
              </span>
              <span className={cn("text-xs tabular-nums", shoot ? "font-semibold" : i === 0 ? "text-brand" : "text-text-secondary")}>
                {d.getDate()}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export type Money = { dueNow: number; dueCount: number; outstanding: number; openCount: number; booked: number; bookedCount: number; collected: number }

export function MoneyGrid({ money, year }: { money: Money | null; year: number }) {
  const cells = [
    { label: "Due now", value: money?.dueNow, note: money && plural(money.dueCount, "payment"), hot: true },
    { label: "Outstanding", value: money?.outstanding, note: money && `across ${plural(money.openCount, "booking")}` },
    { label: `Booked for ${year}`, value: money?.booked, note: money && plural(money.bookedCount, "shoot") },
    { label: `Collected in ${year}`, value: money?.collected, note: money && money.booked ? `${Math.round((money.collected / money.booked) * 100)}% of booked` : null },
  ]
  return (
    <section className="grid h-full grid-cols-2 gap-px border border-border-subtle bg-border-subtle">
      {cells.map((c) => (
        <Link key={c.label} href="/bookings" className="group flex flex-col justify-between bg-surface-elevated p-5 transition-colors hover:bg-surface-hover">
          <span className={microLabel}>{c.label}</span>
          <div className="mt-6">
            <p className={cn("font-heading text-[2rem] leading-none tracking-tight", c.hot && c.value ? "text-brand" : "text-text-primary")}>
              {money ? moneyShort(c.value) : "—"}
            </p>
            <p className="mt-2 min-h-4 text-[10px] uppercase tracking-[0.2em] text-text-faint">{c.note}</p>
          </div>
        </Link>
      ))}
    </section>
  )
}

export type Task = {
  key: string
  tag: string
  hot?: boolean
  title: string
  detail: string
  when?: string
  href: string
  sendLinkTo?: number
}

export function NeedsYou({ tasks }: { tasks: Task[] | null }) {
  return (
    <section className="space-y-5">
      <SectionLabel aside={tasks && <span className="text-[10px] uppercase tracking-[0.3em] text-text-faint">{tasks.length} open</span>}>
        Needs you
      </SectionLabel>
      {tasks == null ? (
        <div className="space-y-px">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-surface-elevated" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="border border-dashed border-border-default px-6 py-10 text-center">
          <p className="font-heading text-xl text-text-primary">All caught up</p>
          <p className="mt-1 text-sm font-light text-text-muted">No payments, deliveries or signatures waiting.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {tasks.map((t, i) => (
            <motion.li
              key={t.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3), ease }}
              className="group relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[104px_1fr_auto]"
            >
              <span
                className={cn(
                  "w-fit border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.2em] max-sm:col-span-2",
                  t.hot ? "border-brand/60 text-brand" : "border-border-default text-text-muted",
                )}
              >
                {t.tag}
              </span>
              <Link href={t.href} className="min-w-0 after:absolute after:inset-0">
                <p className="truncate text-sm text-text-primary">{t.title}</p>
                <p className="truncate text-[12px] font-light text-text-muted">
                  {t.detail}
                  {t.when && <span className="text-text-faint"> · {t.when}</span>}
                </p>
              </Link>
              {t.sendLinkTo ? (
                <SendLinkButton userId={t.sendLinkTo} className="h-8" />
              ) : (
                <ArrowRight className="size-3.5 text-text-faint transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ComingUp({ rows }: { rows: BookingSummary[] | null }) {
  return (
    <section className="space-y-5">
      <SectionLabel
        aside={
          <Link href="/bookings" className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary">
            Bookings
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      >
        Coming up
      </SectionLabel>
      {rows == null ? (
        <div className="h-48 animate-pulse bg-surface-elevated" />
      ) : rows.length === 0 ? (
        <p className="border border-dashed border-border-default px-5 py-8 text-center text-sm font-light text-text-muted">
          No other shoots booked yet.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {rows.map((r) => {
            const d = parseDay(r.event_date)!
            return (
              <li key={r.number}>
                <Link href={`/bookings/${r.number}`} className="group grid grid-cols-[52px_1fr] items-center gap-4 py-3.5">
                  <div className="text-center">
                    <p className="font-heading text-2xl leading-none text-text-primary">{d.getDate()}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-text-faint">
                      {d.toLocaleDateString("en-US", { month: "short" })}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <p className="truncate text-sm text-text-primary transition-colors group-hover:text-brand">
                      {r.client.full_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[11px] font-light text-text-muted">
                        {r.event_type} · {weekday(d)}, {monthDay(d)}
                      </span>
                      {r.status !== "booked" && <StatusChip status={r.status} className="px-1.5 py-0 text-[9px]" />}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function RecentAlbums({ albums }: { albums: Album[] | null }) {
  return (
    <section className="space-y-5">
      <SectionLabel
        aside={
          <Link href="/albums" className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary">
            All albums
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      >
        Latest galleries
      </SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {albums == null
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse bg-surface-elevated" />)
          : albums.map((a) => <AlbumTile key={a.slug} album={a} />)}
      </div>
    </section>
  )
}

function AlbumTile({ album }: { album: Album }) {
  const cover = album.album_photos?.[0]
  const client = album.album_permissions?.[0]?.full_name
  const flags: { icon: ReactNode; label: string }[] = []
  if (album.locked) flags.push({ icon: <Lock className="size-2.5" />, label: "Proofs" })
  if (album.revision && !album.revision.notified_at) flags.push({ icon: <Layers className="size-2.5" />, label: `Rev ${album.revision.number} unsent` })
  return (
    <Link href={`/albums/${album.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden border border-border-subtle bg-surface-elevated">
        {cover ? (
          <Image
            src={cover.compressed_image}
            alt={album.album_name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-faint">
            <ImageOff className="size-6" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/15 to-transparent" />
        {flags.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {flags.map((f) => (
              <span key={f.label} className="flex items-center gap-1 bg-surface/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-brand backdrop-blur">
                {f.icon}
                {f.label}
              </span>
            ))}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="line-clamp-1 font-heading text-lg leading-tight tracking-tight text-text-primary">{album.album_name}</h3>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.15em] text-text-muted">
            {plural(album.image_count, "photo")}
            {client && ` · ${client}`}
          </p>
        </div>
      </div>
    </Link>
  )
}
