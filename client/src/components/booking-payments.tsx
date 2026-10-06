"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Undo2, X } from "lucide-react"
import { bookingsApi } from "@/lib/api"
import { METHOD_LABEL, fmtDay, money } from "@/lib/bookings"
import type { Booking, BookingPayment, PaymentMethod } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { PaymentChip } from "@/components/booking-status"
import { cn } from "@/lib/utils"

const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
const field = "h-10 bg-surface-elevated text-sm md:text-sm"
const smallButton =
  "flex h-8 items-center gap-1.5 whitespace-nowrap border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:pointer-events-none disabled:opacity-50"

const outstanding = (p: BookingPayment) => Math.max(0, p.amount_cents - p.received_cents)

function received(p: BookingPayment) {
  if (!p.received_cents) return null
  return [
    p.received_cents < p.amount_cents ? `${money(p.received_cents)} received` : null,
    p.received_at && fmtDay(p.received_at.slice(0, 10), "short"),
    p.method && METHOD_LABEL[p.method],
  ]
    .filter(Boolean)
    .join(" · ")
}

export function PaymentsTable({
  payments,
  actions,
}: {
  payments: BookingPayment[]
  // admin-only controls per row
  actions?: (p: BookingPayment) => React.ReactNode
}) {
  return (
    <div className="border-y border-border-subtle">
      <div
        className={cn(
          "hidden border-b border-border-subtle py-3 sm:grid sm:items-center sm:gap-4",
          actions
            ? "sm:grid-cols-[minmax(0,1.5fr)_110px_100px_minmax(0,1.3fr)_184px]"
            : "sm:grid-cols-[minmax(0,1.5fr)_110px_100px_minmax(0,1.3fr)]",
        )}
      >
        {["Payment", "Amount", "Status", "Received", ...(actions ? [""] : [])].map((h, i) => (
          <span key={i} className={micro}>
            {h}
          </span>
        ))}
      </div>
      {payments.map((p) => {
        const r = received(p)
        return (
          <div
            key={p.id}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b border-border-subtle py-4 last:border-b-0 sm:items-center sm:gap-4",
              actions
                ? "sm:grid-cols-[minmax(0,1.5fr)_110px_100px_minmax(0,1.3fr)_184px]"
                : "sm:grid-cols-[minmax(0,1.5fr)_110px_100px_minmax(0,1.3fr)]",
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary">{p.label}</p>
              <p className="text-[11px] text-text-faint">
                {p.percent != null ? `${p.percent}% of the fee` : "Added to the final payment"}
              </p>
            </div>
            <p className="text-right font-heading text-lg tabular-nums tracking-tight text-text-primary sm:text-left">
              {money(p.amount_cents)}
            </p>
            <div>
              <PaymentChip state={p.state} />
            </div>
            <div className="min-w-0 text-right sm:text-left">
              <p className="truncate text-[13px] text-text-secondary">
                {r ?? <span className="text-text-faint">—</span>}
              </p>
              {p.note && <p className="truncate text-[11px] text-text-faint">{p.note}</p>}
            </div>
            {actions && <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">{actions(p)}</div>}
          </div>
        )
      })}
    </div>
  )
}

const METHODS: PaymentMethod[] = ["zelle", "cash", "check", "other"]

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function MarkReceivedDialog({
  number,
  payment,
  clientName,
  onDone,
}: {
  number: string
  payment: BookingPayment
  clientName: string
  onDone: (b: Booking) => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("zelle")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const change = (o: boolean) => {
    if (saving) return
    if (o) {
      setAmount((outstanding(payment) / 100).toFixed(2))
      setMethod("zelle")
      setDate(today())
      setNote("")
    }
    setOpen(o)
  }

  const cents = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100)
  const valid = Number.isFinite(cents) && cents > 0 && !!date

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const b = await bookingsApi.receive(number, payment.id, {
        amount_cents: cents,
        method,
        received_at: date,
        note: note.trim() || undefined,
      })
      toast.success(`${payment.label} received · receipt emailed to ${clientName.split(" ")[0]}`)
      onDone(b)
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record the payment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger
        render={
          <button
            className={cn(
              smallButton,
              payment.state === "due"
                ? "border-brand bg-brand text-surface hover:bg-text-primary"
                : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
            )}
          >
            Mark received
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-normal tracking-tight">{payment.label}</DialogTitle>
          <DialogDescription>
            {money(payment.amount_cents)} due from {clientName}. They get an emailed receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <label className="grid gap-1.5">
            <span className={micro}>Amount received</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">
                $
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!valid && !!amount}
                className={cn(field, "pl-6 tabular-nums")}
              />
            </div>
          </label>
          <div className="grid gap-1.5">
            <span className={micro}>Method</span>
            <div className="grid grid-cols-4 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "h-10 border text-[12px] transition-colors",
                    method === m
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
                  )}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1.5">
            <span className={micro}>Date received</span>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="grid gap-1.5">
            <span className={micro}>Note (optional)</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={method === "check" ? "Check #" : "Zelle confirmation, who paid…"}
              className="min-h-16 bg-surface-elevated text-sm md:text-sm"
            />
          </label>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            }
          />
          <Button onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Record {valid ? money(cents) : "payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UndoReceiptButton({
  number,
  payment,
  onDone,
}: {
  number: string
  payment: BookingPayment
  onDone: (b: Booking) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const undo = async () => {
    setOpen(false)
    setBusy(true)
    try {
      onDone(await bookingsApi.undo(number, payment.id))
      toast.success(`${payment.label} receipt undone`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't undo that")
    } finally {
      setBusy(false)
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <button
            disabled={busy}
            className={cn(
              smallButton,
              "border-transparent text-text-muted hover:border-border-default hover:text-text-primary",
            )}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Undo2 className="size-3" />}
            Undo
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Undo this receipt?</AlertDialogTitle>
          <AlertDialogDescription>
            Clears the {money(payment.received_cents)} recorded for the {payment.label.toLowerCase()}. No email is sent,
            and the booking may move back a step.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={undo}>
            Undo receipt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function RemoveChargeButton({
  number,
  payment,
  onDone,
}: {
  number: string
  payment: BookingPayment
  onDone: (b: Booking) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    setOpen(false)
    setBusy(true)
    try {
      onDone(await bookingsApi.removeCharge(number, payment.id))
      toast.success(`${payment.label} removed`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the charge")
    } finally {
      setBusy(false)
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <button
            disabled={busy}
            aria-label={`Remove ${payment.label}`}
            className={cn(
              smallButton,
              "border-transparent px-2 text-text-muted hover:border-destructive/40 hover:text-destructive",
            )}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this charge?</AlertDialogTitle>
          <AlertDialogDescription>
            {payment.label} ({money(payment.amount_cents)}) comes off the final payment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove}>
            Remove charge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AddChargeDialog({ number, onDone }: { number: string; onDone: (b: Booking) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("Overtime")
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)

  const cents = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100)
  const valid = !!label.trim() && Number.isFinite(cents) && cents > 0

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      onDone(await bookingsApi.addCharge(number, { label: label.trim(), amount_cents: cents }))
      toast.success(`${label.trim()} added to the final payment`)
      setOpen(false)
      setLabel("Overtime")
      setAmount("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the charge")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
      <DialogTrigger
        render={
          <button
            className={cn(
              smallButton,
              "h-9 border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
            )}
          >
            <Plus className="size-3.5" />
            Add charge
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-normal tracking-tight">Add a charge</DialogTitle>
          <DialogDescription>Overtime or an add-on. It&apos;s due with the final payment.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <label className="grid gap-1.5">
            <span className={micro}>Description</span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Overtime — 45 min"
              className={field}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={micro}>Amount</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">
                $
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn(field, "pl-6 tabular-nums")}
              />
            </div>
            <span className="text-[12px] text-text-muted">
              Overtime is billed at the hourly rate in 15-minute steps.
            </span>
          </label>
        </div>
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            }
          />
          <Button onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Add {valid ? money(cents) : "charge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
