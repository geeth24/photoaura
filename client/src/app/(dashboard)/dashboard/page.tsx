"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useAuth } from "@/context/auth-context"
import { apiFetch, bookingsApi } from "@/lib/api"
import { fmtDay, moneyShort, parseDay } from "@/lib/bookings"
import { daysFromToday, plural, relativeDay } from "@/lib/format"
import type { Album, Booking, BookingSummary, DashboardStats, User } from "@/lib/types"
import { brandButton, PageHeader, quietButton } from "@/components/page-header"
import { UploadAlbumDialog } from "@/components/upload-album-dialog"
import { ComingUp, MoneyGrid, NeedsYou, NextShoot, RecentAlbums, type Money, type Task } from "@/components/studio-desk"

const OPEN = new Set(["sent", "signed", "booked"])
const PRIORITY = ["Collect", "Deliver", "Revision", "Signature", "Invite", "Draft"]

function greeting(now: Date) {
  const h = now.getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

function upcomingOf(rows: BookingSummary[]) {
  return rows
    .filter((r) => OPEN.has(r.status) && daysFromToday(parseDay(r.event_date)!) >= 0)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
}

function moneyOf(rows: BookingSummary[], year: number): Money {
  const live = rows.filter((r) => r.status !== "cancelled" && r.status !== "draft")
  const due = live.filter((r) => r.next_payment?.due)
  const open = live.filter((r) => r.total_due_cents > r.paid_cents)
  const thisYear = live.filter((r) => parseDay(r.event_date)?.getFullYear() === year)
  return {
    dueNow: due.reduce((n, r) => n + (r.next_payment?.amount_cents ?? 0), 0),
    dueCount: due.length,
    outstanding: open.reduce((n, r) => n + r.total_due_cents - r.paid_cents, 0),
    openCount: open.length,
    booked: thisYear.reduce((n, r) => n + r.total_due_cents, 0),
    bookedCount: thisYear.length,
    collected: thisYear.reduce((n, r) => n + r.paid_cents, 0),
  }
}

function bookingTasks(r: BookingSummary): Task[] {
  if (r.status === "cancelled") return []
  const href = `/bookings/${r.number}`
  const title = `${r.client.full_name} · ${r.event_type}`
  const out: Task[] = []
  if (r.next_payment?.due)
    out.push({ key: `pay-${r.number}`, tag: "Collect", hot: true, title, detail: `${r.next_payment.label} ${moneyShort(r.next_payment.amount_cents)} is due`, href })
  if (r.status === "event_complete")
    out.push({ key: `deliver-${r.number}`, tag: "Deliver", hot: true, title, detail: "Shot, gallery not delivered yet", when: `shot ${relativeDay(parseDay(r.event_date))}`, href })
  if (r.status === "sent")
    out.push({ key: `sign-${r.number}`, tag: "Signature", title, detail: `Agreement sent for ${fmtDay(r.event_date, "short")}`, when: `created ${relativeDay(r.created_at)}`, href })
  if (r.status === "draft")
    out.push({ key: `draft-${r.number}`, tag: "Draft", title, detail: "Not sent to the client yet", when: relativeDay(r.created_at), href })
  return out
}

const revisionTask = (a: Album): Task[] =>
  a.revision && !a.revision.notified_at
    ? [{ key: `rev-${a.slug}`, tag: "Revision", title: a.album_name, detail: `Revision ${a.revision.number} uploaded, client not emailed`, when: relativeDay(a.revision.created_at), href: `/albums/${a.slug}` }]
    : []

// a client with galleries who has never opened one
const inviteTask = (u: User): Task[] =>
  u.role === "client" && !u.parent_user_id && !u.last_login_at && u.albums?.length
    ? [{ key: `invite-${u.id}`, tag: "Invite", title: u.full_name, detail: `${plural(u.albums.length, "gallery", "galleries")}, never signed in`, href: `/users/${u.id}`, sendLinkTo: u.id }]
    : []

// everything that's waiting on the studio, money and deliveries first
function tasksOf(rows: BookingSummary[], albums: Album[], users: User[]): Task[] {
  return [...rows.flatMap(bookingTasks), ...albums.flatMap(revisionTask), ...users.flatMap(inviteTask)].sort(
    (a, b) => PRIORITY.indexOf(a.tag) - PRIORITY.indexOf(b.tag),
  )
}

export default function DashboardPage() {
  useDocumentTitle("Dashboard")
  const { user } = useAuth()
  const [rows, setRows] = useState<BookingSummary[] | null>(null)
  const [albums, setAlbums] = useState<Album[] | null>(null)
  const [users, setUsers] = useState<User[] | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [next, setNext] = useState<Booking | null>(null)
  const now = useMemo(() => new Date(), [])

  // each panel fills in as its own request lands
  useEffect(() => {
    if (!user) return
    bookingsApi.list().then(setRows).catch(() => setRows([]))
    apiFetch<Album[]>("/albums/").then(setAlbums).catch(() => setAlbums([]))
    apiFetch<User[]>("/users/").then(setUsers).catch(() => setUsers([]))
    apiFetch<DashboardStats>("/dashboard/").then(setStats).catch(() => {})
  }, [user])

  const upcoming = useMemo(() => (rows ? upcomingOf(rows) : null), [rows])
  const money = useMemo(() => (rows ? moneyOf(rows, now.getFullYear()) : null), [rows, now])
  const tasks = useMemo(() => (rows && albums && users ? tasksOf(rows, albums, users) : null), [rows, albums, users])
  const shootDays = useMemo(() => new Set((upcoming ?? []).map((r) => parseDay(r.event_date)!.toDateString())), [upcoming])
  const nextNumber = upcoming?.[0]?.number

  useEffect(() => {
    if (!nextNumber) return
    bookingsApi.get(nextNumber).then(setNext).catch(() => {})
  }, [nextNumber])

  const firstName = user?.full_name?.trim().split(" ")[0]
  const thisWeek = upcoming?.filter((r) => daysFromToday(parseDay(r.event_date)!) < 7).length ?? 0
  const toDeliver = rows?.filter((r) => r.status === "event_complete").length ?? 0
  const summary = rows
    ? [
        thisWeek
          ? `${plural(thisWeek, "shoot")} in the next 7 days`
          : upcoming?.[0]
            ? `Next shoot ${fmtDay(upcoming[0].event_date, "short").replace(/, \d{4}$/, "")}`
            : "Nothing booked yet",
        money?.dueNow ? `${moneyShort(money.dueNow)} due from clients` : null,
        toDeliver ? `${plural(toDeliver, "gallery", "galleries")} to deliver` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Checking the calendar…"

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow={now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={firstName ? `${greeting(now)}, ${firstName}` : "Dashboard"}
        subtitle={summary}
        actions={
          <>
            {user && (
              <UploadAlbumDialog
                mode="new"
                userId={user.id}
                onUploaded={() => apiFetch<Album[]>("/albums/").then(setAlbums)}
                trigger={
                  <button className={quietButton}>
                    <Plus className="size-3.5" />
                    New album
                  </button>
                }
              />
            )}
            <Link href="/bookings/new" className={brandButton}>
              <Plus className="size-3.5" />
              New booking
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <NextShoot summary={upcoming?.[0] ?? null} detail={next?.number === nextNumber ? next : null} shootDays={shootDays} />
        </div>
        <div className="lg:col-span-2">
          <MoneyGrid money={money} year={now.getFullYear()} />
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-5 lg:gap-10">
        <div className="lg:col-span-3">
          <NeedsYou tasks={tasks} />
        </div>
        <div className="lg:col-span-2">
          <ComingUp rows={upcoming ? upcoming.slice(1, 6) : null} />
        </div>
      </div>

      <RecentAlbums albums={albums ? albums.slice(0, 4) : null} />

      {stats && (
        <p className="border-t border-border-subtle pt-6 text-[10px] uppercase tracking-[0.3em] text-text-faint">
          Library · {plural(stats.albums, "album")} · {plural(stats.photos, "photo")} · {plural(stats.users, "account")}
        </p>
      )}
    </div>
  )
}
