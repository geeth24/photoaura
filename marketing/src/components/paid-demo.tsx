"use client"

import { useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, Check, Download, Lock, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Eyebrow, Lede, SectionTitle, chipButton, chipIdle } from "@/components/demo-ui"

const ease = [0.22, 1, 0.36, 1] as const
const micro = "text-[10px] font-medium uppercase tracking-[0.2em] text-text-faint"
const chip =
  "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] whitespace-nowrap"

const STEPS = ["Signed", "Date secured", "Event day", "Gallery delivered", "Paid in full"]
const PROOFS = ["wed-veil", "wed-mother", "wed-cypress", "wed-firstdance"]

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 })

function Steps({ done }: { done: number }) {
  return (
    <ol className="grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-5">
      {STEPS.map((label, i) => {
        const isDone = i < done
        const isNext = i === done
        return (
          <li
            key={label}
            className={cn(
              "relative flex items-center gap-3 bg-surface-elevated px-4 py-2.5 sm:flex-col sm:items-start sm:gap-2.5 sm:py-4",
              isNext && "bg-surface-card",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-0.5 sm:inset-x-0 sm:bottom-auto sm:top-0 sm:h-0.5 sm:w-auto",
                isDone ? "bg-brand" : isNext ? "bg-brand/40" : "bg-transparent",
              )}
            />
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center border text-[10px] font-semibold tabular-nums",
                isDone ? "border-brand bg-brand text-surface" : isNext ? "border-brand text-brand" : "border-border-default text-text-faint",
              )}
            >
              {isDone ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.16em]",
                isDone ? "text-text-primary" : isNext ? "text-brand" : "text-text-faint",
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

type Row = { label: string; sub: string; cents: number; state: "paid" | "due"; received?: string }

function Payments({ rows }: { rows: Row[] }) {
  return (
    <div className="border-y border-border-subtle">
      <div className="hidden grid-cols-[minmax(0,1.5fr)_90px_80px_minmax(0,1.2fr)] gap-4 border-b border-border-subtle py-3 sm:grid">
        {["Payment", "Amount", "Status", "Received"].map((h) => (
          <span key={h} className={micro}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((p) => (
        <div
          key={p.label}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b border-border-subtle py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1.5fr)_90px_80px_minmax(0,1.2fr)] sm:items-center sm:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-text-primary">{p.label}</p>
            <p className="text-[11px] text-text-faint">{p.sub}</p>
          </div>
          <p className="text-right font-heading text-lg tabular-nums tracking-tight text-text-primary sm:text-left">
            {money(p.cents)}
          </p>
          <div>
            <span
              className={cn(
                chip,
                p.state === "paid" ? "border-border-default text-text-primary" : "border-brand/60 text-brand",
              )}
            >
              {p.state === "paid" && <Check className="size-3" />}
              {p.state === "paid" ? "Paid" : "Due"}
            </span>
          </div>
          <p className="min-w-0 truncate text-right text-[13px] text-text-secondary sm:text-left">
            {p.received ?? <span className="text-text-faint">—</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

export function PaidDemo() {
  const [paid, setPaid] = useState(false)

  const rows: Row[] = [
    { label: "Booking retainer", sub: "10% of the fee", cents: 48000, state: "paid", received: "Jul 9, 2026 · Zelle" },
    { label: "Event-day payment", sub: "40% of the fee", cents: 192000, state: "paid", received: "Oct 18, 2026 · Check" },
    {
      label: "Final payment",
      sub: "50% of the fee",
      cents: 240000,
      state: paid ? "paid" : "due",
      received: paid ? "Nov 3, 2026 · Zelle" : undefined,
    },
    {
      label: "Extra hour of coverage",
      sub: "Added to the final payment",
      cents: 35000,
      state: paid ? "paid" : "due",
      received: paid ? "Nov 3, 2026 · Zelle" : undefined,
    },
  ]

  return (
    <section id="payments" className="border-t border-border-subtle bg-surface py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease }}
          >
            <Eyebrow className="mb-6">Bookings and proofs</Eyebrow>
            <SectionTitle>
              Proofs until it&apos;s paid.
              <br />
              <span className="text-brand">Full files once it is.</span>
            </SectionTitle>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            <Lede>
              Clients sign the agreement online and see every payment on their booking. Deliver the gallery
              before the balance clears: they get watermarked, downsized proofs while the originals stay held.
              Mark the final payment received and the full-resolution files come back on their own, with an
              email to say so.
            </Lede>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="mt-14 grid gap-px border border-border-subtle bg-border-subtle lg:grid-cols-2"
        >
          {/* studio: the booking */}
          <div className="space-y-6 bg-surface-elevated p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={micro}>Booking RS-1042</p>
                <h3 className="mt-2 font-heading text-2xl tracking-tight text-text-primary">Sofia &amp; Daniel · Wedding</h3>
                <p className="mt-1 text-[13px] font-light text-text-muted">Oct 18, 2026 · Clifftop venue, 8 hours</p>
              </div>
              <span
                className={cn(
                  chip,
                  paid ? "border-brand bg-brand text-surface" : "border-brand/60 text-brand",
                )}
              >
                {paid ? "Paid in full" : "Final due"}
              </span>
            </div>
            <Steps done={paid ? 5 : 4} />
            <Payments rows={rows} />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPaid((v) => !v)}
                className={cn(
                  "flex h-10 items-center gap-2 px-5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors",
                  paid
                    ? "border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                    : "bg-brand text-surface hover:bg-text-primary",
                )}
              >
                {paid ? <Undo2 className="size-3.5" /> : <Check className="size-3.5" />}
                {paid ? "Undo receipt" : "Mark final payment received"}
              </button>
              <span className="text-[12px] font-light text-text-faint">
                {paid ? "Receipt emailed to Sofia." : "Try it: this is the studio's side."}
              </span>
            </div>
          </div>

          {/* client: the gallery */}
          <div className="space-y-5 bg-surface p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={micro}>What Sofia sees</p>
              <AnimatePresence mode="wait" initial={false}>
                {paid ? (
                  <motion.span
                    key="dl"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={cn(chipButton, chipIdle)}
                  >
                    <Download className="size-3" />
                    Download all
                  </motion.span>
                ) : (
                  <motion.span
                    key="lock"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-1.5 border border-brand/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-brand"
                  >
                    <Lock className="size-3" />
                    Preview
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {paid ? (
                <motion.div
                  key="paid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3.5 border border-l-2 border-border-subtle border-l-brand bg-surface-elevated px-5 py-4"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  <p className="text-sm text-text-primary">
                    Your gallery is unlocked. Every photo is back at full resolution.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="proof"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap items-center justify-between gap-4 border border-l-2 border-border-subtle border-l-brand bg-surface-elevated px-5 py-4"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <Lock className="mt-0.5 size-4 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary">
                        Gallery preview — full-resolution downloads unlock after your final payment ($2,750).
                      </p>
                      <p className="mt-1 text-[13px] font-light text-text-muted">
                        Until then you&apos;re seeing watermarked previews.
                      </p>
                    </div>
                  </div>
                  <span className="flex h-9 shrink-0 items-center gap-1.5 border border-border-default px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                    View booking
                    <ArrowUpRight className="size-3" />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-[3px]">
              {PROOFS.map((id) => (
                <div key={id} className="relative aspect-square overflow-hidden bg-surface-elevated">
                  <Image src={`/demo/${id}.webp`} alt="" fill sizes="(max-width: 1024px) 50vw, 300px" className="object-cover" />
                  {/* the real proof render, faded out once paid */}
                  <Image
                    src={`/demo/${id}-proof.webp`}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 300px"
                    className={cn("object-cover transition-opacity duration-700", paid ? "opacity-0" : "opacity-100")}
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
