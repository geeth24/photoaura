"use client"

import Link from "next/link"
import { ArrowUpRight, CalendarHeart, FileSignature, ReceiptText } from "lucide-react"
import { fmtDay, money, parseDay } from "@/lib/bookings"
import type { MyBookingSummary } from "@/lib/types"

// the booking worth surfacing on home: something to sign, then something to pay, then the next event
export function pickHomeBooking(rows: MyBookingSummary[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = rows
    .filter((b) => b.status !== "cancelled" && b.status !== "draft" && (parseDay(b.event_date) ?? today) >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  return rows.find((b) => b.action === "sign") ?? rows.find((b) => b.action === "pay") ?? upcoming[0] ?? null
}

function daysUntil(d: string) {
  const day = parseDay(d)
  if (!day) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((day.getTime() - today.getTime()) / 86400000)
}

export function BookingCard({ booking: b }: { booking: MyBookingSummary }) {
  const n = daysUntil(b.event_date)
  const when = n == null ? "" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : n > 1 ? `In ${n} days` : ""
  const view =
    b.action === "sign"
      ? {
          icon: FileSignature,
          eyebrow: "Action needed",
          title: "Review and sign your agreement",
          body: `${b.event_type} · ${fmtDay(b.event_date)}. Your date is held once it's signed and the retainer arrives.`,
          cta: "Review & sign",
        }
      : b.action === "pay" && b.next_payment
        ? {
            icon: ReceiptText,
            eyebrow: "Payment due",
            title: `${b.next_payment.label} · ${money(b.next_payment.amount_cents)}`,
            body: `${b.event_type} · ${fmtDay(b.event_date)}. Zelle, cash, or check.`,
            cta: "How to pay",
          }
        : {
            icon: CalendarHeart,
            eyebrow: when ? `Coming up · ${when}` : "Coming up",
            title: b.event_type,
            body: `${fmtDay(b.event_date)} · ${b.package_name}`,
            cta: "View booking",
          }
  const Icon = view.icon
  const urgent = b.action != null

  return (
    <Link
      href={`/bookings/${b.number}`}
      className="group relative block overflow-hidden border border-border-subtle border-l-2 border-l-brand bg-surface-elevated transition-colors hover:border-border-strong hover:border-l-brand"
    >
      {urgent && <div className="pointer-events-none absolute -right-20 -top-24 size-64 bg-brand/15 blur-[90px]" />}
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center bg-brand/10 text-brand">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-brand">{view.eyebrow}</p>
            <p className="mt-2 font-heading text-[1.65rem] leading-tight tracking-tight text-text-primary sm:text-3xl">
              {view.title}
            </p>
            <p className="mt-1.5 text-[13px] font-light leading-relaxed text-text-secondary">{view.body}</p>
          </div>
        </div>
        <span
          className={
            urgent
              ? "flex h-12 shrink-0 items-center justify-center gap-2 bg-brand px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all group-hover:bg-text-primary group-hover:shadow-[0_0_40px_rgba(0,166,251,0.3)]"
              : "flex h-12 shrink-0 items-center justify-center gap-2 border border-border-default px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors group-hover:border-border-strong group-hover:text-text-primary"
          }
        >
          {view.cta}
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
    </Link>
  )
}
