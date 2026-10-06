"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { ReceiptText } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { bookingsApi } from "@/lib/api"
import { fmtDay, money } from "@/lib/bookings"
import type { MyInvoice } from "@/lib/types"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceChip } from "@/components/booking-status"
import { InvoiceButton } from "@/components/invoice-button"
import { cn } from "@/lib/utils"

const eyebrow = "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"
const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
const ease = [0.22, 1, 0.36, 1] as const
const cols =
  "lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_130px_170px] lg:items-center lg:gap-5"

// the studio reaches invoices from each booking
export default function InvoicesPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== "client") router.replace("/bookings")
  }, [user, router])

  if (user?.role !== "client") return null
  return <ClientInvoices />
}

function ClientInvoices() {
  useDocumentTitle("Invoices")
  const [rows, setRows] = useState<MyInvoice[] | null>(null)

  useEffect(() => {
    bookingsApi
      .myInvoices()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])

  if (rows == null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-60" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  const live = rows.filter((r) => r.status !== "cancelled")
  const billed = live.reduce((a, r) => a + r.total_cents, 0)
  const paid = live.reduce((a, r) => a + r.paid_cents, 0)
  const balance = live.reduce((a, r) => a + r.balance_cents, 0)

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className={eyebrow}>Billing</span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,5vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          Invoices
        </h1>
        <p className="mt-3 text-sm font-light text-text-secondary">
          {rows.length === 0
            ? "Nothing billed yet."
            : balance > 0
              ? `${money(balance)} outstanding across ${rows.length} ${rows.length === 1 ? "invoice" : "invoices"}`
              : "You're all paid up. Thank you!"}
        </p>
      </motion.div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <ReceiptText className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-xl text-text-primary">No invoices yet</p>
          <p className="mt-1 max-w-xs text-sm font-light text-text-muted">
            Each booking gets an invoice once your photographer sends the agreement.
          </p>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease }}
            className="grid grid-cols-3 gap-px border border-border-subtle bg-border-subtle"
          >
            {[
              { label: "Billed", v: billed },
              { label: "Paid", v: paid },
              { label: "Balance", v: balance, strong: true },
            ].map((x) => (
              <div key={x.label} className="bg-surface-elevated px-4 py-4 sm:px-5">
                <p className={micro}>{x.label}</p>
                <p
                  className={cn(
                    "mt-1.5 font-heading text-xl tabular-nums tracking-tight sm:text-3xl",
                    x.strong && x.v > 0 ? "text-brand" : "text-text-primary",
                  )}
                >
                  {money(x.v)}
                </p>
              </div>
            ))}
          </motion.div>

          <div className="border-y border-border-subtle">
            <div className={cn("hidden border-b border-border-subtle py-3", cols)}>
              {["Invoice", "Event", "Total", "Paid", "Balance", "Status", ""].map((h, i) => (
                <span key={i} className={cn(micro, i >= 2 && i <= 4 && "text-right")}>
                  {h}
                </span>
              ))}
            </div>
            {rows.map((r, i) => (
              <motion.div
                key={r.invoice_number}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(0.1 + i * 0.04, 0.4), ease }}
              >
                <InvoiceRow r={r} />
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function InvoiceRow({ r }: { r: MyInvoice }) {
  const cancelled = r.status === "cancelled"
  const amount = (label: string, cents: number, strong = false) => (
    <div className="lg:text-right">
      <p className={cn(micro, "lg:hidden")}>{label}</p>
      <p
        className={cn(
          "mt-1 text-sm tabular-nums lg:mt-0",
          cancelled ? "text-text-faint line-through" : strong && cents > 0 ? "text-brand" : "text-text-primary",
        )}
      >
        {money(cents)}
      </p>
    </div>
  )

  return (
    <div className={cn("grid grid-cols-3 gap-x-4 gap-y-4 border-b border-border-subtle py-5 last:border-b-0", cols)}>
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <p className="text-sm font-medium tabular-nums tracking-wide text-text-primary">{r.invoice_number}</p>
        <Link
          href={`/bookings/${r.booking_number}`}
          className="mt-0.5 inline-block text-[12px] text-text-muted transition-colors hover:text-brand"
        >
          Booking {r.booking_number}
        </Link>
      </div>
      <div className="col-start-3 row-start-1 flex items-start justify-end lg:hidden">
        <InvoiceChip status={r.status} />
      </div>
      <div className="col-span-3 min-w-0 lg:col-span-1">
        <p className="truncate text-sm text-text-primary">{r.event_type}</p>
        <p className="truncate text-[12px] text-text-muted">{fmtDay(r.event_date)}</p>
        {r.status === "due" && r.next_payment && (
          <p className="mt-0.5 truncate text-[12px] text-brand">
            {r.next_payment.label} · {money(r.next_payment.amount_cents)} due now
          </p>
        )}
      </div>
      {amount("Total", r.total_cents)}
      {amount("Paid", r.paid_cents)}
      {amount("Balance", r.balance_cents, true)}
      <div className="hidden lg:block">
        <InvoiceChip status={r.status} />
      </div>
      <InvoiceButton number={r.booking_number} mine label="Download PDF" className="col-span-3 lg:col-span-1" />
    </div>
  )
}
