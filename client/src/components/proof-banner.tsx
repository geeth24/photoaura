"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Lock } from "lucide-react"
import { bookingsApi } from "@/lib/api"
import { money } from "@/lib/bookings"

// shown on a proof-locked album; the studio sees the same thing in its own words
export function ProofBanner({
  bookingNumber,
  albumSlug,
  studio = false,
  linkable = true,
}: {
  bookingNumber?: string | null
  albumSlug?: string
  studio?: boolean
  // share-page visitors may not have an account to open the booking with
  linkable?: boolean
}) {
  const [amount, setAmount] = useState<number | null>(null)
  const [number, setNumber] = useState<string | null>(bookingNumber ?? null)

  // the album only says it's locked; the client's own booking knows what's left to pay
  useEffect(() => {
    if (studio || !linkable) return
    bookingsApi
      .mine()
      .then((rows) => {
        const b = rows.find((r) => r.number === bookingNumber || (!!albumSlug && r.album_slug === albumSlug))
        if (!b) return
        setNumber(b.number)
        if (b.next_payment?.kind === "final" || b.next_payment?.kind === "extra") setAmount(b.next_payment.amount_cents)
      })
      .catch(() => {})
  }, [bookingNumber, albumSlug, studio, linkable])

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-l-2 border-border-subtle border-l-brand bg-surface-elevated px-5 py-4">
      <div className="flex min-w-0 items-start gap-3.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-sm text-text-primary">
            {studio
              ? "Gallery preview — the client's full-resolution downloads unlock when the final payment is marked received."
              : `Gallery preview — full-resolution downloads unlock after your final payment${amount ? ` (${money(amount)})` : ""}.`}
          </p>
          <p className="mt-1 text-[13px] font-light text-text-muted">
            {studio ? "Downloads are off for everyone until then." : "Until then you're seeing watermarked previews."}
          </p>
        </div>
      </div>
      {linkable && number && (
        <Link
          href={`/bookings/${number}`}
          className="flex h-9 shrink-0 items-center gap-1.5 border border-border-default px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {studio ? `Booking ${number}` : "View booking"}
          <ArrowUpRight className="size-3" />
        </Link>
      )}
    </div>
  )
}
