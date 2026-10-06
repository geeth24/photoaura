"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowUpRight, CalendarPlus, CalendarX2, Plus } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { bookingsApi } from "@/lib/api"
import { fmtDay, money, parseDay } from "@/lib/bookings"
import type { BookingStatus, BookingSummary, MyBookingSummary } from "@/lib/types"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/booking-status"
import { cn } from "@/lib/utils"

const eyebrow = "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"
const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
const ease = [0.22, 1, 0.36, 1] as const

export default function BookingsPage() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === "client") return <ClientBookings />
  return <StudioBookings />
}

const FILTERS: { key: string; label: string; match: (s: BookingStatus) => boolean }[] = [
  { key: "active", label: "Active", match: (s) => s !== "paid" && s !== "cancelled" },
  { key: "action", label: "Awaiting client", match: (s) => s === "sent" || s === "signed" || s === "delivered" },
  { key: "draft", label: "Drafts", match: (s) => s === "draft" },
  { key: "paid", label: "Paid", match: (s) => s === "paid" },
  { key: "cancelled", label: "Cancelled", match: (s) => s === "cancelled" },
  { key: "all", label: "All", match: () => true },
]

const cols =
  "lg:grid lg:grid-cols-[84px_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_150px_minmax(0,1.1fr)] lg:items-center lg:gap-5"

function StudioBookings() {
  useDocumentTitle("Bookings")
  const [rows, setRows] = useState<BookingSummary[] | null>(null)
  const [filter, setFilter] = useState("active")

  useEffect(() => {
    bookingsApi
      .list()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, rows?.filter((r) => f.match(r.status)).length ?? 0])),
    [rows],
  )
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0]
    return (rows ?? []).filter((r) => f.match(r.status))
  }, [rows, filter])

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <div className="mb-4 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className={eyebrow}>Clients</span>
          </div>
          <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
            Bookings
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            {rows == null ? "Loading bookings…" : `${counts.active} active · ${counts.action} waiting on a client`}
          </p>
        </div>
        <Link
          href="/bookings/new"
          className="flex h-11 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)]"
        >
          <Plus className="size-3.5" />
          New booking
        </Link>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex h-9 items-center gap-2 border px-3.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors",
              filter === f.key
                ? "border-brand text-brand"
                : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
            )}
          >
            {f.label}
            <span className="tabular-nums text-text-faint">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {rows == null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <CalendarPlus className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-xl text-text-primary">
            {rows.length === 0 ? "No bookings yet" : "Nothing here"}
          </p>
          <p className="mt-1 text-sm font-light text-text-muted">
            {rows.length === 0
              ? "Create one and the client gets an agreement to sign."
              : "No bookings match this filter."}
          </p>
        </div>
      ) : (
        <div className="border-y border-border-subtle">
          <div className={cn("hidden border-b border-border-subtle py-3", cols)}>
            {["No.", "Client", "Event", "Package", "Total", "Status", "Next payment"].map((h) => (
              <span key={h} className={micro}>
                {h}
              </span>
            ))}
          </div>
          {shown.map((b, i) => (
            <motion.div
              key={b.number}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3), ease }}
            >
              <Link
                href={`/bookings/${b.number}`}
                className={cn(
                  "group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-b border-border-subtle py-4 transition-colors last:border-b-0 hover:bg-surface-elevated/60",
                  cols,
                )}
              >
                <span className="text-[12px] font-medium tabular-nums tracking-wide text-text-muted group-hover:text-brand">
                  {b.number}
                </span>
                <span className="col-start-2 row-start-1 lg:hidden">
                  <StatusChip status={b.status} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-text-primary">{b.client.full_name}</span>
                  <span className="block truncate text-[12px] text-text-muted">{b.client.email}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text-primary">{b.event_type}</span>
                  <span className="block truncate text-[12px] text-text-muted">{fmtDay(b.event_date, "short")}</span>
                </span>
                <span className="hidden truncate text-[13px] text-text-secondary lg:block">{b.package_name}</span>
                <span className="hidden lg:block">
                  <span className="block text-sm tabular-nums text-text-primary">{money(b.total_due_cents)}</span>
                  <span className="block text-[11px] tabular-nums text-text-faint">{money(b.paid_cents)} paid</span>
                </span>
                <span className="hidden lg:block">
                  <StatusChip status={b.status} />
                </span>
                <span className="col-span-2 flex items-center justify-between gap-3 lg:col-span-1">
                  {b.next_payment ? (
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm tabular-nums",
                          b.next_payment.due ? "text-brand" : "text-text-secondary",
                        )}
                      >
                        {money(b.next_payment.amount_cents)}
                      </span>
                      <span className="block truncate text-[11px] text-text-faint">
                        {b.next_payment.label} · {b.next_payment.due ? "due now" : "upcoming"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-text-faint">—</span>
                  )}
                  <ArrowUpRight className="size-4 shrink-0 text-text-faint opacity-0 transition-opacity group-hover:text-brand group-hover:opacity-100" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// upcoming soonest first; past (and cancelled) most recent first
function splitByDate(rows: MyBookingSummary[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPast = (b: MyBookingSummary) => b.status === "cancelled" || (parseDay(b.event_date) ?? today) < today
  return {
    upcoming: rows.filter((b) => !isPast(b)).sort((a, b) => a.event_date.localeCompare(b.event_date)),
    past: rows.filter(isPast).sort((a, b) => b.event_date.localeCompare(a.event_date)),
  }
}

function ClientBookings() {
  useDocumentTitle("Your bookings")
  const [rows, setRows] = useState<MyBookingSummary[] | null>(null)

  useEffect(() => {
    bookingsApi
      .mine()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])

  if (rows == null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  const { upcoming, past } = splitByDate(rows)

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className={eyebrow}>Bookings</span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          Your bookings
        </h1>
        {rows.length > 0 && (
          <p className="mt-3 text-sm font-light text-text-secondary">
            {upcoming.length} upcoming · {past.length} past
          </p>
        )}
      </motion.div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <CalendarX2 className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-xl text-text-primary">No bookings yet</p>
          <p className="mt-1 max-w-xs text-sm font-light text-text-muted">
            When your photographer sends an agreement, it shows up here.
          </p>
        </div>
      ) : (
        [
          { label: "Upcoming", list: upcoming },
          { label: "Past", list: past },
        ]
          .filter((g) => g.list.length > 0)
          .map((g, gi) => (
            <section key={g.label} className="space-y-4">
              <p className={micro}>{g.label}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {g.list.map((b, i) => (
                  <motion.div
                    key={b.number}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: Math.min((gi * 2 + i) * 0.05, 0.3), ease }}
                  >
                    <ClientBookingCard b={b} />
                  </motion.div>
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  )
}

function ClientBookingCard({ b }: { b: MyBookingSummary }) {
  return (
    <Link
      href={`/bookings/${b.number}`}
      className="group flex h-full flex-col gap-5 border border-border-subtle bg-surface-elevated p-5 transition-colors hover:border-border-strong sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={micro}>{b.number}</p>
          <p className="mt-2 font-heading text-2xl leading-tight tracking-tight text-text-primary">{b.event_type}</p>
          <p className="mt-1 text-[13px] text-text-secondary">{fmtDay(b.event_date)}</p>
        </div>
        <StatusChip status={b.status} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-4 border-t border-border-subtle pt-4">
        <p className="text-[13px] text-text-muted">
          {b.status === "cancelled"
            ? "This booking was cancelled"
            : b.action === "sign"
              ? "Review and sign your agreement"
              : b.next_payment
                ? `${b.next_payment.label} · ${money(b.next_payment.amount_cents)}${b.next_payment.due ? " due now" : ""}`
                : `${money(b.paid_cents)} of ${money(b.total_due_cents)} paid`}
        </p>
        <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-colors group-hover:text-brand" />
      </div>
    </Link>
  )
}
