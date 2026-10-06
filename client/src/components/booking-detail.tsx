"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  CalendarDays,
  Download,
  Eye,
  FileSignature,
  ImagePlus,
  Images,
  Link2,
  Loader2,
  Lock,
  LockOpen,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Send,
  Truck,
} from "lucide-react"
import { apiFetch, bookingsApi, getUploadStatus, type UploadStatus } from "@/lib/api"
import { downloadContract, fmtDay, fmtStamp, fmtTime, money } from "@/lib/bookings"
import type { Album, Booking } from "@/lib/types"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ContractView } from "@/components/contract-view"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { BookingSteps, StatusChip } from "@/components/booking-status"
import {
  AddChargeDialog,
  MarkReceivedDialog,
  PaymentsTable,
  RemoveChargeButton,
  UndoReceiptButton,
} from "@/components/booking-payments"
import { cn } from "@/lib/utils"

const eyebrow = "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"
const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
const outline =
  "flex h-10 items-center gap-2 border border-border-default px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
const brand =
  "flex h-10 items-center gap-2 bg-brand px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"
const ease = [0.22, 1, 0.36, 1] as const

function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("border border-border-subtle bg-surface-elevated", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
        <span className={cn(eyebrow, "flex items-center gap-2")}>
          <Icon className="size-3.5" />
          {title}
        </span>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// confirm-then-run for the one-click actions that email the client or change access
function Confirm({
  trigger,
  title,
  body,
  confirm,
  destructive,
  onConfirm,
  children,
}: {
  trigger: React.ReactElement
  title: string
  body: React.ReactNode
  confirm: string
  destructive?: boolean
  onConfirm: () => void
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BookingDetail({ number }: { number: string }) {
  const [b, setB] = useState<Booking | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  // bumped when the server starts a proof/unlock job, so the album card starts polling
  const [jobKick, setJobKick] = useState(0)
  useDocumentTitle(b ? `${b.number} · ${b.client.full_name}` : number)

  const load = useCallback(() => {
    bookingsApi
      .get(number)
      .then(setB)
      .catch(() => setB(null))
  }, [number])

  useEffect(() => {
    load()
  }, [load])

  // every mutation returns the full booking, so the page just swaps it in
  const act = useCallback(
    async (key: string, fn: () => Promise<Booking & { processing?: boolean; email_sent?: boolean }>, done: string) => {
      setBusy(key)
      try {
        const res = await fn()
        setB(res)
        if (res.email_sent === false) toast.warning("Saved, but the email didn't go out. Try Resend.")
        else toast.success(done)
        if (res.processing) setJobKick((k) => k + 1)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong")
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  const pdf = async () => {
    if (!b) return
    try {
      await downloadContract(b.number, !b.contract.signed)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't download the PDF")
    }
  }

  if (b === undefined) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }
  if (!b) {
    return (
      <div className="flex flex-col items-center border border-dashed border-border-default py-16 text-center">
        <p className="font-heading text-xl text-text-primary">Booking not found</p>
        <Link href="/bookings" className="mt-3 text-sm text-brand hover:underline">
          Back to bookings
        </Link>
      </div>
    )
  }

  const first = b.client.full_name.split(" ")[0]
  const cancelled = b.status === "cancelled"
  const canSend = b.status === "draft" || b.status === "sent"
  const canDeliver = (b.status === "booked" || b.status === "event_complete") && !!b.album
  const finalDue = b.payments
    .filter((p) => p.kind === "final" || p.kind === "extra")
    .reduce((a, p) => a + p.amount_cents - p.received_cents, 0)

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div className="min-w-0">
          <Link
            href="/bookings"
            className="group mb-4 flex items-center gap-4 text-text-muted transition-colors hover:text-text-primary"
          >
            <span className="block h-px w-12 bg-brand" />
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
              <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
              Bookings
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12px] font-medium tabular-nums tracking-wide text-text-muted">{b.number}</span>
            <StatusChip status={b.status} />
          </div>
          <h1 className="mt-3 font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
            {b.client.full_name}
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            {b.event.type} · {fmtDay(b.event.date)} · {b.package.name}
            {b.package.hours ? `, ${b.package.hours} hrs` : ""}
          </p>
        </div>
        {!cancelled && (
          <div className="flex flex-wrap gap-3">
            <Link href={`/bookings/${b.number}/edit`} className={outline}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
            {canSend && (
              <Confirm
                trigger={
                  <button className={brand} disabled={busy === "send"}>
                    {busy === "send" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    {b.status === "draft" ? "Send to client" : "Resend"}
                  </button>
                }
                title={b.status === "draft" ? `Send the agreement to ${first}?` : `Resend to ${first}?`}
                body={`${b.client.email} gets an email with a sign-in link to review and sign.`}
                confirm={b.status === "draft" ? "Send" : "Resend"}
                onConfirm={() => act("send", () => bookingsApi.send(b.number), `Agreement sent to ${b.client.email}`)}
              />
            )}
          </div>
        )}
      </motion.div>

      {cancelled ? (
        <div className="flex items-start gap-3 border border-destructive/30 bg-destructive/5 px-5 py-4">
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm text-text-primary">Cancelled {b.cancelled_at ? fmtStamp(b.cancelled_at) : ""}</p>
            {b.cancel_reason && <p className="mt-1 text-sm font-light text-text-secondary">{b.cancel_reason}</p>}
          </div>
        </div>
      ) : b.status === "draft" ? (
        <div className="border border-dashed border-border-default px-5 py-4 text-sm text-text-secondary">
          Draft — {first} hasn&apos;t seen this yet. Send it when the details look right.
        </div>
      ) : (
        <BookingSteps status={b.status} />
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* money */}
          <Card
            title="Payments"
            icon={CalendarDays}
            action={!cancelled && b.status !== "paid" ? <AddChargeDialog number={b.number} onDone={setB} /> : null}
          >
            <div className="mb-5 grid grid-cols-2 gap-px border border-border-subtle bg-border-subtle sm:grid-cols-4">
              {[
                { label: "Total fee", v: b.money.total_fee },
                { label: "Extras", v: b.money.extras },
                { label: "Paid", v: b.money.paid },
                { label: "Balance", v: b.money.balance, strong: true },
              ].map((x) => (
                <div key={x.label} className="bg-surface-elevated px-4 py-4">
                  <p className={micro}>{x.label}</p>
                  <p
                    className={cn(
                      "mt-1.5 font-heading text-2xl tabular-nums tracking-tight",
                      x.strong && x.v > 0 ? "text-brand" : "text-text-primary",
                    )}
                  >
                    {money(x.v)}
                  </p>
                </div>
              ))}
            </div>
            <PaymentsTable
              payments={b.payments}
              actions={
                cancelled
                  ? undefined
                  : (p) =>
                      p.received_cents > 0 ? (
                        <>
                          {p.state !== "paid" && (
                            <MarkReceivedDialog
                              number={b.number}
                              payment={p}
                              clientName={b.client.full_name}
                              onDone={setB}
                            />
                          )}
                          <UndoReceiptButton number={b.number} payment={p} onDone={setB} />
                        </>
                      ) : (
                        <>
                          <MarkReceivedDialog
                            number={b.number}
                            payment={p}
                            clientName={b.client.full_name}
                            onDone={setB}
                          />
                          {p.kind === "extra" && <RemoveChargeButton number={b.number} payment={p} onDone={setB} />}
                        </>
                      )
              }
            />
            <p className="mt-4 text-[12px] text-text-muted">
              Total due {money(b.money.total_due)}. Retainer, event-day and final are 10/40/50 of the fee; extras ride
              with the final.
            </p>
          </Card>

          {/* contract */}
          <Card title="Agreement" icon={FileSignature}>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 space-y-1.5">
                <p className="font-heading text-xl tracking-tight text-text-primary">
                  {b.contract.signed
                    ? `Signed by ${b.contract.signed_name}`
                    : b.contract.sent_at
                      ? "Waiting for signature"
                      : "Not sent yet"}
                </p>
                <p className="text-[13px] text-text-secondary">
                  {b.contract.signed
                    ? `${fmtStamp(b.contract.signed_at)}${b.contract.signed_ip ? ` · ${b.contract.signed_ip}` : ""}`
                    : b.contract.sent_at
                      ? `Sent ${fmtStamp(b.contract.sent_at)} to ${b.client.email}`
                      : "Preview it, then send it from the top of the page."}
                </p>
                {b.contract.hash && (
                  <p className="truncate font-mono text-[11px] text-text-faint" title={b.contract.hash}>
                    v{b.contract.version} · sha256 {b.contract.hash.slice(0, 16)}…
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <ContractDialog booking={b} />
                <button onClick={pdf} className={outline}>
                  <Download className="size-3.5" />
                  {b.contract.signed ? "Signed PDF" : "Draft PDF"}
                </button>
              </div>
            </div>
          </Card>

          {/* gallery */}
          <AlbumCard
            booking={b}
            busy={busy}
            canDeliver={canDeliver}
            finalDue={finalDue}
            jobKick={jobKick}
            onJobDone={load}
            onLink={(body, msg) => act("album", () => bookingsApi.linkAlbum(b.number, body), msg)}
            onDeliver={() => act("deliver", () => bookingsApi.delivered(b.number), `Proof gallery sent to ${first}`)}
            onUnlock={(notify) =>
              act(
                "unlock",
                () => bookingsApi.unlock(b.number, notify),
                notify ? `Unlocking — ${first} gets an email when it's done` : "Unlocking the gallery",
              )
            }
          />
        </div>

        <div className="space-y-6">
          <Card title="Client" icon={Mail}>
            <p className="text-base text-text-primary">{b.client.full_name}</p>
            <div className="mt-3 space-y-2 text-[13px] text-text-secondary">
              <a href={`mailto:${b.client.email}`} className="flex items-center gap-2 hover:text-brand">
                <Mail className="size-3.5 text-text-faint" />
                {b.client.email}
              </a>
              {b.client.phone && (
                <a href={`tel:${b.client.phone}`} className="flex items-center gap-2 hover:text-brand">
                  <Phone className="size-3.5 text-text-faint" />
                  {b.client.phone}
                </a>
              )}
            </div>
            <Link
              href={`/users/${b.client.user_id}`}
              className="mt-4 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted hover:text-brand"
            >
              Client profile <ArrowUpRight className="size-3" />
            </Link>
          </Card>

          <Card title="Event" icon={MapPin}>
            <dl className="space-y-3 text-[13px]">
              {[
                ["Type", b.event.type],
                ["Date", fmtDay(b.event.date)],
                ["Time", `${fmtTime(b.event.start_time)} – ${fmtTime(b.event.end_time)}`],
                ["Location", b.event.location],
                ["Package", `${b.package.name}${b.package.hours ? `, ${b.package.hours} hrs` : ""}`],
                [
                  "Includes",
                  `${b.package.includes_video ? "Photos + video" : "Photos"} · ${b.package.revisions} revision ${b.package.revisions === 1 ? "round" : "rounds"}${b.package.hourly_rate_cents ? ` · overtime ${money(b.package.hourly_rate_cents)}/hr` : ""}`,
                ],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3">
                  <dt className={micro}>{k}</dt>
                  <dd className="text-text-primary">{v}</dd>
                </div>
              ))}
            </dl>
            {b.details_for_client && (
              <div className="mt-5 border-l-2 border-brand pl-4">
                <p className={micro}>For the client</p>
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-text-secondary">
                  {b.details_for_client}
                </p>
              </div>
            )}
          </Card>

          {b.notes_internal && (
            <Card title="Internal notes" icon={Lock}>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-text-secondary">{b.notes_internal}</p>
            </Card>
          )}

          <Card title="Activity" icon={CalendarDays}>
            <ol className="relative space-y-4 border-l border-border-subtle pl-5">
              {[...b.timeline].reverse().map((t, i) => (
                <li key={i} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[23px] top-1.5 block size-[7px] border",
                      i === 0 ? "border-brand bg-brand" : "border-border-strong bg-surface-elevated",
                    )}
                  />
                  <p className="text-[13px] text-text-primary">{t.label}</p>
                  <p className="text-[11px] text-text-faint">{fmtStamp(t.at)}</p>
                </li>
              ))}
            </ol>
          </Card>

          {!cancelled && b.status !== "paid" && <CancelBooking booking={b} onDone={setB} />}
        </div>
      </div>
    </div>
  )
}

function AlbumCard({
  booking: b,
  busy,
  canDeliver,
  finalDue,
  onLink,
  onDeliver,
  onUnlock,
  jobKick,
  onJobDone,
}: {
  booking: Booking
  busy: string | null
  canDeliver: boolean
  finalDue: number
  onLink: (body: { album_id: number } | { create: true }, msg: string) => void
  onDeliver: () => void
  onUnlock: (notify: boolean) => void
  jobKick: number
  onJobDone: () => void
}) {
  const a = b.album
  const first = b.client.full_name.split(" ")[0]
  const cancelled = b.status === "cancelled"
  const [notify, setNotify] = useState(true)
  const job = useProofJob(a?.slug ?? null, jobKick, onJobDone)

  return (
    <Card
      title="Gallery"
      icon={Images}
      action={
        a ? (
          a.locked ? (
            <span className="flex items-center gap-1.5 border border-brand/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-brand">
              <Lock className="size-3" /> Proof · locked
            </span>
          ) : (
            <span className="flex items-center gap-1.5 border border-border-default px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary">
              <LockOpen className="size-3" /> Unlocked
            </span>
          )
        ) : null
      }
    >
      {a ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href={`/albums/${a.slug}`} className="group min-w-0">
              <p className="truncate font-heading text-xl tracking-tight text-text-primary group-hover:text-brand">
                {a.name}
              </p>
              <p className="mt-1 text-[13px] text-text-secondary">
                {a.locked
                  ? "Watermarked proofs. Downloads unlock with the final payment."
                  : b.unlocked_at
                    ? `Full resolution since ${fmtStamp(b.unlocked_at)}`
                    : "Full resolution, downloads open."}
              </p>
            </Link>
            <Link href={`/albums/${a.slug}`} className={outline}>
              Open album <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {job && <JobProgress job={job} />}
          {!cancelled && (canDeliver || a.locked) && (
            <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-5">
              {canDeliver && (
                <Confirm
                  trigger={
                    <button className={brand} disabled={busy === "deliver"}>
                      {busy === "deliver" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Truck className="size-3.5" />
                      )}
                      Mark gallery delivered
                    </button>
                  }
                  title={`Deliver the proof gallery to ${first}?`}
                  body={`${first} gets an email with the gallery link and the final payment due (${money(finalDue)}). Downloads stay locked until it's received.`}
                  confirm="Deliver"
                  onConfirm={onDeliver}
                />
              )}
              {a.locked && (
                <Confirm
                  trigger={
                    <button className={outline} disabled={busy === "unlock" || !!job}>
                      {busy === "unlock" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <LockOpen className="size-3.5" />
                      )}
                      Unlock now
                    </button>
                  }
                  title="Unlock before the final payment?"
                  body="Swaps the proofs for the clean full-resolution files and opens downloads. Payments marked received unlock it on their own, so use this only for an exception."
                  confirm="Unlock gallery"
                  onConfirm={() => onUnlock(notify)}
                >
                  <label className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
                    Email {first} when the full-resolution files are ready
                  </label>
                </Confirm>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-[13px] text-text-secondary">
            No gallery yet. Linking one puts it in proof mode, so downloads stay locked until the final payment.
          </p>
          {!cancelled && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <LinkAlbumDialog onPick={(id, name) => onLink({ album_id: id }, `${name} linked in proof mode`)} />
              <button
                className={brand}
                disabled={busy === "album"}
                onClick={() => onLink({ create: true }, "Album created")}
              >
                {busy === "album" ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                Create album
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// lock (proofing) and unlock jobs run in the background on the server
function useProofJob(slug: string | null, kick: number, onDone: () => void) {
  const [job, setJob] = useState<UploadStatus | null>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (!slug) return
    let on = true
    let seen = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const s = await getUploadStatus(slug)
        if (!on) return
        const ours = s.active && (s.kind === "lock" || s.kind === "unlock")
        setJob(ours ? s : null)
        if (ours) {
          seen = true
          timer = setTimeout(tick, 1500)
        } else if (seen) {
          done.current()
        }
      } catch {
        if (on) setJob(null)
      }
    }
    tick()
    return () => {
      on = false
      clearTimeout(timer)
    }
  }, [slug, kick])

  return job
}

const JOB_LABEL: Record<string, string> = {
  proofing: "Making watermarked proofs",
  unlocking: "Restoring full-resolution files",
  warming: "Warming the CDN",
}

function JobProgress({ job }: { job: UploadStatus }) {
  const pct = job.total ? Math.round((job.current / job.total) * 100) : null
  return (
    <div className="space-y-2 border border-border-subtle bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-text-secondary">
        <span className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-brand" />
          {JOB_LABEL[job.phase] ?? (job.kind === "unlock" ? "Unlocking" : "Locking")}
        </span>
        {job.total > 0 && (
          <span className="tabular-nums text-text-faint">
            {job.current}/{job.total}
          </span>
        )}
      </div>
      <div className="h-0.5 w-full bg-border-subtle">
        <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${pct ?? 8}%` }} />
      </div>
    </div>
  )
}

function ContractDialog({ booking: b }: { booking: Booking }) {
  const [open, setOpen] = useState(false)
  const [markdown, setMarkdown] = useState<string | null>(b.contract.markdown)

  // drafts have no snapshot yet; render what would be sent
  useEffect(() => {
    if (!open || b.contract.markdown) return
    bookingsApi
      .preview({ number: b.number })
      .then((p) => setMarkdown(p.contract_markdown))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't render the agreement"))
  }, [open, b.number, b.contract.markdown])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className={outline}>
            <Eye className="size-3.5" />
            {b.contract.signed ? "View" : "Preview"}
          </button>
        }
      />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-normal tracking-tight">
            {b.contract.signed ? "Signed agreement" : b.contract.sent_at ? "Agreement as sent" : "Agreement preview"}
          </DialogTitle>
          <DialogDescription>
            {b.contract.signed
              ? `Exactly what ${b.contract.signed_name} signed on ${fmtStamp(b.contract.signed_at)}.`
              : "This is what the client reads before signing."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70dvh] overflow-y-auto border border-border-subtle bg-surface px-5 py-8 sm:px-10">
          {markdown ? (
            <ContractView markdown={markdown} />
          ) : (
            <div className="space-y-3">
              <Skeleton className="mx-auto h-6 w-2/3" />
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LinkAlbumDialog({ onPick }: { onPick: (id: number, name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [albums, setAlbums] = useState<Album[] | null>(null)
  const [q, setQ] = useState("")

  useEffect(() => {
    if (!open || albums) return
    apiFetch<Album[]>("/albums/")
      .then(setAlbums)
      .catch(() => setAlbums([]))
  }, [open, albums])

  const shown = useMemo(
    () => (albums ?? []).filter((a) => a.album_name.toLowerCase().includes(q.trim().toLowerCase())),
    [albums, q],
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className={outline}>
            <Link2 className="size-3.5" />
            Link existing
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-normal tracking-tight">Link an album</DialogTitle>
          <DialogDescription>
            Photos already in it are swapped for watermarked proofs in the background.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-faint" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search albums"
            className="h-10 bg-surface-elevated pl-9 text-sm md:text-sm"
          />
        </div>
        <div className="max-h-72 divide-y divide-border-subtle overflow-y-auto border border-border-subtle">
          {albums == null ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : shown.length === 0 ? (
            <p className="px-3 py-3 text-sm font-light text-text-muted">No albums match.</p>
          ) : (
            shown.map((a) => (
              <button
                key={a.slug}
                onClick={() => {
                  if (a.album_id == null) return
                  onPick(a.album_id, a.album_name)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text-primary">{a.album_name}</span>
                  <span className="block text-[11px] text-text-muted">
                    {a.image_count} {a.image_count === 1 ? "photo" : "photos"}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-brand">Link</span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelBooking({ booking: b, onDone }: { booking: Booking; onDone: (b: Booking) => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    setBusy(true)
    try {
      onDone(await bookingsApi.cancel(b.number, reason.trim()))
      setOpen(false)
      toast.success(`${b.number} cancelled`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't cancel")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return
        if (o) setReason("")
        setOpen(o)
      }}
    >
      <AlertDialogTrigger
        render={
          <button className="flex w-full items-center justify-center gap-2 border border-dashed border-border-default py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:border-destructive/50 hover:text-destructive">
            <Ban className="size-3.5" />
            Cancel booking
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {b.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            {b.client.full_name}&apos;s {b.event.type.toLowerCase()} on {fmtDay(b.event.date, "short")} comes off the
            calendar. Money already received ({money(b.money.paid)}) stays on record; refunds happen outside the app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (for your records)"
          className="min-h-20 bg-surface-elevated text-sm md:text-sm"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={cancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel booking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
