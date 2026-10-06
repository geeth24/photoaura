import { Check } from "lucide-react"
import { CLIENT_STEPS, STATUS_LABEL, STEPS_DONE } from "@/lib/bookings"
import type { BookingPayment, BookingStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const chip =
  "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] whitespace-nowrap"

// brand = waiting on someone, quiet = in hand, filled = done
const TONE: Record<BookingStatus, string> = {
  draft: "border-dashed border-border-default text-text-muted",
  sent: "border-brand/60 text-brand",
  signed: "border-brand/60 text-brand",
  booked: "border-border-default text-text-primary",
  event_complete: "border-border-default text-text-primary",
  delivered: "border-brand/60 text-brand",
  paid: "border-brand bg-brand text-surface",
  cancelled: "border-destructive/40 text-destructive",
}

export function StatusChip({ status, className }: { status: BookingStatus; className?: string }) {
  return <span className={cn(chip, TONE[status], className)}>{STATUS_LABEL[status]}</span>
}

const PAYMENT_TONE: Record<BookingPayment["state"], string> = {
  upcoming: "border-border-subtle text-text-faint",
  due: "border-brand/60 text-brand",
  paid: "border-border-default text-text-primary",
}

export function PaymentChip({ state }: { state: BookingPayment["state"] }) {
  return (
    <span className={cn(chip, PAYMENT_TONE[state])}>
      {state === "paid" && <Check className="size-3" />}
      {state === "due" ? "Due" : state === "paid" ? "Paid" : "Upcoming"}
    </span>
  )
}

export function BookingSteps({ status }: { status: BookingStatus }) {
  const done = STEPS_DONE[status]
  return (
    <ol className="grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-5">
      {CLIENT_STEPS.map((label, i) => {
        const isDone = i < done
        const isNext = i === done && status !== "cancelled"
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
                isDone
                  ? "border-brand bg-brand text-surface"
                  : isNext
                    ? "border-brand text-brand"
                    : "border-border-default text-text-faint",
              )}
            >
              {isDone ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.18em]",
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
