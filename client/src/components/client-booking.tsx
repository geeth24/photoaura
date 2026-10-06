"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUpRight,
  Ban,
  Banknote,
  Check,
  Copy,
  Download,
  FileSignature,
  Images,
  Landmark,
  Loader2,
  Lock,
  ReceiptText,
  Smartphone,
} from "lucide-react"
import { ApiError, bookingsApi } from "@/lib/api"
import { ZELLE, downloadContract, fmtDay, fmtStamp, fmtTime, money } from "@/lib/bookings"
import type { Booking, BookingPayment, NextPayment } from "@/lib/types"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ContractView } from "@/components/contract-view"
import { BookingSteps, StatusChip } from "@/components/booking-status"
import { PaymentsTable } from "@/components/booking-payments"
import { cn } from "@/lib/utils"

const CONSENT_TEXT = "I agree to sign this agreement electronically, and that typing my name below is my signature."

const eyebrow = "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"
const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
const ease = [0.22, 1, 0.36, 1] as const
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease },
})

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="block h-px w-12 bg-brand" />
      <span className={eyebrow}>{children}</span>
    </div>
  )
}

export function ClientBooking({ number }: { number: string }) {
  const [b, setB] = useState<Booking | null | undefined>(undefined)
  useDocumentTitle(b ? `${b.event.type} · ${b.number}` : "Your booking")

  const load = useCallback(() => {
    return bookingsApi
      .mineOne(number)
      .then(setB)
      .catch(() => setB(null))
  }, [number])

  useEffect(() => {
    load()
  }, [load])

  if (b === undefined) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-14 w-full max-w-md" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (!b) {
    return (
      <div className="flex flex-col items-center border border-dashed border-border-default py-20 text-center">
        <FileSignature className="size-6 text-text-faint" />
        <p className="mt-4 font-heading text-2xl text-text-primary">Booking not found</p>
        <p className="mt-2 max-w-xs text-sm font-light text-text-muted">
          This link may be for a different account. Sign in with the email the booking was sent to.
        </p>
        <Link
          href="/albums"
          className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-brand hover:underline"
        >
          Go to your photos
        </Link>
      </div>
    )
  }

  if (b.status === "cancelled") {
    return (
      <div className="space-y-6">
        <Eyebrow>Booking {b.number}</Eyebrow>
        <h1 className="font-heading text-[clamp(2.25rem,5vw,3.5rem)] leading-[0.95] tracking-tight text-text-primary">
          This booking was cancelled.
        </h1>
        <div className="flex items-start gap-3 border border-border-subtle bg-surface-elevated px-5 py-4">
          <Ban className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <p className="text-sm font-light text-text-secondary">
            Your {b.event.type.toLowerCase()} on {fmtDay(b.event.date)} is no longer on the calendar. Questions? Email{" "}
            <a href="mailto:geeth@reactiveshots.com" className="text-brand hover:underline">
              geeth@reactiveshots.com
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  return b.contract.signed ? <Signed b={b} /> : <Unsigned b={b} onChanged={load} onSigned={setB} />
}

function EventFacts({ b, columns = 3 }: { b: Booking; columns?: 2 | 3 }) {
  const maps = `https://maps.google.com/?q=${encodeURIComponent(b.event.location)}`
  const facts: [string, React.ReactNode][] = [
    ["Event", b.event.type],
    ["Date", fmtDay(b.event.date)],
    ["Time", `${fmtTime(b.event.start_time)} – ${fmtTime(b.event.end_time)}`],
    [
      "Location",
      <a key="l" href={maps} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
        {b.event.location}
      </a>,
    ],
    ["Package", `${b.package.name}${b.package.hours ? `, ${b.package.hours} hours` : ""}`],
    [
      "Includes",
      `${b.package.includes_video ? "Photos + video" : "Photos"} · ${b.package.revisions} revision ${b.package.revisions === 1 ? "round" : "rounds"}`,
    ],
  ]
  return (
    <dl
      className={cn(
        "grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
      )}
    >
      {facts.map(([k, v]) => (
        <div key={k} className="bg-surface-elevated px-5 py-4">
          <dt className={micro}>{k}</dt>
          <dd className="mt-1.5 text-[15px] leading-snug text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Details({ text }: { text: string }) {
  return (
    <div className="border-l-2 border-brand bg-surface-elevated px-5 py-4">
      <p className={micro}>From your photographer</p>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-text-secondary">{text}</p>
    </div>
  )
}

function Unsigned({
  b,
  onChanged,
  onSigned,
}: {
  b: Booking
  onChanged: () => Promise<void>
  onSigned: (b: Booking) => void
}) {
  const first = b.client.full_name.split(" ")[0]
  const [name, setName] = useState("")
  const [consent, setConsent] = useState(false)
  const [signing, setSigning] = useState(false)
  const [stale, setStale] = useState(false)
  const pay = (k: BookingPayment["kind"]) => b.payments.find((p) => p.kind === k)?.amount_cents ?? 0
  const ready = !!name.trim() && consent && !!b.contract.hash && !!b.contract.markdown

  const sign = async () => {
    if (!ready || !b.contract.hash) return
    setSigning(true)
    try {
      const signed = await bookingsApi.sign(b.number, {
        full_name: name.trim(),
        consent: true,
        contract_hash: b.contract.hash,
      })
      onSigned(signed)
      window.scrollTo({ top: 0 })
      toast.success("Signed. A copy is on its way to your inbox.")
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // the agreement changed while it was open; they have to re-read the new one
        setStale(true)
        setConsent(false)
        await onChanged()
        window.scrollTo({ top: 0, behavior: "smooth" })
        toast.error("The contract was updated — please review again.")
      } else {
        toast.error(e instanceof Error ? e.message : "Couldn't sign. Please try again.")
      }
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="space-y-12">
      <motion.div {...fade()} className="space-y-6">
        <Eyebrow>Booking {b.number}</Eyebrow>
        <h1 className="font-heading text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.92] tracking-tight text-text-primary">
          Let&apos;s lock in your date.
        </h1>
        <p className="max-w-xl text-[15px] font-light leading-relaxed text-text-secondary">
          Hi {first}, thank you for choosing Reactive Shots! Here&apos;s everything we talked about. Read it through,
          sign at the bottom, and your {fmtDay(b.event.date, "short")} date is held once the retainer arrives.
        </p>
        <a
          href="#sign"
          className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-brand hover:underline"
        >
          <ArrowDown className="size-3.5" />
          Jump to signature
        </a>
      </motion.div>

      {stale && (
        <div className="border border-brand/50 bg-brand/5 px-5 py-4 text-sm text-text-primary">
          The contract was updated — please review again. The new version is below.
        </div>
      )}

      <motion.section {...fade(0.06)} className="space-y-4">
        <EventFacts b={b} />
        <div className="grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-4">
          <div className="bg-surface-card px-5 py-4">
            <p className={micro}>Total fee</p>
            <p className="mt-1.5 font-heading text-3xl tabular-nums tracking-tight text-brand">
              {money(b.money.total_fee)}
            </p>
          </div>
          {[
            ["Retainer · 10%", pay("retainer"), "After you sign"],
            ["Event day · 40%", pay("event_day"), "After coverage"],
            ["Final · 50%", pay("final"), "When your gallery is ready"],
          ].map(([k, v, when]) => (
            <div key={k as string} className="bg-surface-elevated px-5 py-4">
              <p className={micro}>{k}</p>
              <p className="mt-1.5 font-heading text-2xl tabular-nums tracking-tight text-text-primary">
                {money(v as number)}
              </p>
              <p className="mt-0.5 text-[12px] text-text-faint">{when}</p>
            </div>
          ))}
        </div>
        {b.details_for_client && <Details text={b.details_for_client} />}
      </motion.section>

      <motion.section {...fade(0.12)} className="space-y-4">
        <Eyebrow>Your agreement</Eyebrow>
        <div className="border border-border-subtle bg-surface-elevated px-5 py-10 sm:px-12 sm:py-14">
          <div className="mx-auto max-w-[68ch]">
            {b.contract.markdown ? (
              <ContractView markdown={b.contract.markdown} />
            ) : (
              <p className="text-center text-sm text-text-muted">The agreement isn&apos;t ready yet.</p>
            )}
          </div>
        </div>
      </motion.section>

      <section id="sign" className="scroll-mt-24 border border-border-default bg-surface-elevated">
        <div className="border-b border-border-subtle px-5 py-4 sm:px-8">
          <span className={cn(eyebrow, "flex items-center gap-2")}>
            <FileSignature className="size-3.5" /> Signature
          </span>
        </div>
        <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
          {/* the consent wording points at the name "below", so it sits above the field */}
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5 size-5" />
            <span className="text-[15px] leading-snug text-text-primary">{CONSENT_TEXT}</span>
          </label>

          <label className="grid gap-2">
            <span className={micro}>Type your full name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              className="h-12 bg-surface text-base md:text-base"
            />
          </label>

          {/* how the typed name will sit on the signature line */}
          <div className="border-b border-border-strong pb-2">
            <p
              className={cn(
                "min-h-[2.75rem] font-heading text-[2rem] italic leading-none tracking-tight",
                name.trim() ? "text-text-primary" : "text-text-faint",
              )}
            >
              {name.trim() || "Your name"}
            </p>
          </div>
          <p className="-mt-4 text-[12px] text-text-faint">
            Client signature ·{" "}
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>

          <div className="flex flex-col gap-4 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-[12px] leading-relaxed text-text-muted">
              We keep your name, the time, and your IP address with the signed copy. You&apos;ll get the PDF by email.
            </p>
            <button
              onClick={sign}
              disabled={!ready || signing}
              className="flex h-12 items-center justify-center gap-2 bg-brand px-8 text-[12px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"
            >
              {signing ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}
              {signing ? "Signing…" : "Sign agreement"}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

const HEADLINE: Partial<Record<Booking["status"], [string, string]>> = {
  signed: ["Signed. One step left.", "Your date is held as soon as the retainer arrives."],
  booked: ["Your date is secured.", "Everything's set. We'll be in touch before the day."],
  event_complete: ["Thank you for having us.", "We're editing your photos now."],
  delivered: ["Your proof gallery is ready.", "Full-resolution downloads unlock with the final payment."],
  paid: ["Paid in full. Thank you!", "Your full-resolution gallery is unlocked."],
}

function Signed({ b }: { b: Booking }) {
  const [downloading, setDownloading] = useState(false)
  const [title, sub] = HEADLINE[b.status] ?? ["Your booking", ""]

  const pdf = async () => {
    setDownloading(true)
    try {
      await downloadContract(b.number)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't download the agreement")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-12">
      <motion.div {...fade()} className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <Eyebrow>Booking {b.number}</Eyebrow>
          <StatusChip status={b.status} />
        </div>
        <h1 className="font-heading text-[clamp(2.5rem,6vw,4rem)] leading-[0.95] tracking-tight text-text-primary">
          {title}
        </h1>
        <p className="text-[15px] font-light text-text-secondary">
          {sub} {b.event.type} · {fmtDay(b.event.date)}
        </p>
      </motion.div>

      <motion.div {...fade(0.05)}>
        <BookingSteps status={b.status} />
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {b.next_payment && (
            <motion.div {...fade(0.1)}>
              <NextPaymentCard b={b} next={b.next_payment} />
            </motion.div>
          )}

          {b.album && (
            <motion.div {...fade(0.14)}>
              <Link
                href={`/albums/${b.album.slug}`}
                className="group flex items-center justify-between gap-4 border border-border-subtle bg-surface-elevated px-5 py-5 transition-colors hover:border-border-strong sm:px-6"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center bg-brand/10 text-brand">
                    <Images className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className={micro}>{b.album.locked ? "Proof gallery" : "Your gallery"}</p>
                    <p className="mt-1 truncate font-heading text-2xl tracking-tight text-text-primary">
                      {b.album.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-text-muted">
                      {b.album.locked && <Lock className="size-3" />}
                      {b.album.locked
                        ? "Full-resolution downloads unlock after your final payment."
                        : "Full resolution, ready to download."}
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="size-5 shrink-0 text-text-faint transition-colors group-hover:text-brand" />
              </Link>
            </motion.div>
          )}

          <motion.section {...fade(0.18)} className="space-y-4">
            <Eyebrow>Payments</Eyebrow>
            <PaymentsTable payments={b.payments} />
            <div className="flex flex-wrap justify-between gap-2 text-[13px]">
              <span className="text-text-muted">
                {money(b.money.paid)} of {money(b.money.total_due)} paid
              </span>
              {b.money.balance > 0 && <span className="text-text-secondary">Balance {money(b.money.balance)}</span>}
            </div>
          </motion.section>
        </div>

        <div className="space-y-6">
          <motion.section {...fade(0.12)} className="space-y-4">
            <Eyebrow>Your event</Eyebrow>
            <EventFacts b={b} columns={2} />
            {b.details_for_client && <Details text={b.details_for_client} />}
          </motion.section>

          <motion.section {...fade(0.16)} className="border border-border-subtle bg-surface-elevated p-5 sm:p-6">
            <p className={micro}>Agreement</p>
            <p className="mt-2 text-[15px] text-text-primary">Signed by {b.contract.signed_name}</p>
            <p className="mt-0.5 text-[13px] text-text-muted">{fmtStamp(b.contract.signed_at)}</p>
            <button
              onClick={pdf}
              disabled={downloading}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
            >
              {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              Download signed agreement
            </button>
          </motion.section>
        </div>
      </div>
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Couldn't copy — select it and copy by hand")
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 border border-border-default bg-surface px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-text-faint">{label}</p>
        <p className="truncate font-mono text-[14px] text-text-primary select-all">{value}</p>
      </div>
      <button
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 border px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
          copied
            ? "border-brand text-brand"
            : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
        )}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

function NextPaymentCard({ b, next }: { b: Booking; next: NonNullable<NextPayment> }) {
  const { due, kind } = next
  const extras = kind === "final" || kind === "extra" ? b.money.extras : 0
  const zelle = b.payment_instructions?.zelle ?? ZELLE
  const memo = b.payment_instructions?.memo ?? b.number

  return (
    <section className="relative overflow-hidden border border-border-subtle bg-surface-elevated">
      {due && <div className="pointer-events-none absolute -right-16 -top-16 size-56 bg-brand/15 blur-[80px]" />}
      <div className="relative flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle px-5 py-5 sm:px-6">
        <div>
          <p className={cn(micro, due && "text-brand")}>{due ? "Next payment · due now" : "Coming up"}</p>
          <p className="mt-2 font-heading text-[2.6rem] leading-none tabular-nums tracking-tight text-text-primary">
            {money(next.amount_cents)}
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            {next.label}
            {kind === "event_day" && !due && ` · due after coverage on ${fmtDay(b.event.date, "short")}`}
            {(kind === "final" || kind === "extra") && !due && " · due when your gallery is delivered"}
            {extras > 0 && ` · includes ${money(extras)} in added charges`}
          </p>
        </div>
        <ReceiptText className="size-6 text-text-faint max-sm:hidden" />
      </div>

      {due && (
        <div className="relative space-y-5 px-5 py-5 sm:px-6">
          <p className={micro}>How to pay</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm text-text-primary">
                  Zelle <span className="text-text-muted">— fastest</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <CopyRow label="Send to" value={zelle} />
                  <CopyRow label="Memo" value={memo} />
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Banknote className="mt-0.5 size-4 shrink-0 text-text-muted" />
              <p className="text-sm text-text-secondary">
                <span className="text-text-primary">Cash</span> — in person, at your session or event.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Landmark className="mt-0.5 size-4 shrink-0 text-text-muted" />
              <p className="text-sm text-text-secondary">
                <span className="text-text-primary">Check</span> — hand it over in person, with {b.number} on the memo
                line.
              </p>
            </div>
          </div>
          <p className="border-t border-border-subtle pt-4 text-[12px] text-text-muted">
            We&apos;ll email you a receipt as soon as it&apos;s marked received.
          </p>
        </div>
      )}
    </section>
  )
}
