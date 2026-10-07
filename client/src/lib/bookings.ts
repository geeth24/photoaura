import { bookingsApi } from "@/lib/api"
import type { BookingStatus, PaymentMethod } from "@/lib/types"

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export const money = (cents: number | null | undefined) => usd.format((cents ?? 0) / 100)

// whole-dollar amounts read cleaner in headlines; cents only when they exist
export const moneyShort = (cents: number | null | undefined) => {
  const c = cents ?? 0
  return c % 100 === 0 ? usd.format(c / 100).replace(/\.00$/, "") : usd.format(c / 100)
}

// "2026-11-14" is a calendar day, not an instant — parse it local so it never slips a day
export function parseDay(d: string | null | undefined) {
  if (!d) return null
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}

export function fmtDay(d: string | null | undefined, style: "long" | "short" = "long") {
  const day = parseDay(d)
  if (!day) return d ?? ""
  return day.toLocaleDateString("en-US", {
    weekday: style === "long" ? "long" : undefined,
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  })
}

export function fmtTime(t: string | null | undefined) {
  const m = t?.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return t ?? ""
  const h = +m[1]
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`
}

export function fmtStamp(iso: string | null | undefined) {
  if (!iso) return ""
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  draft: "Draft",
  sent: "Awaiting signature",
  signed: "Awaiting retainer",
  booked: "Booked",
  event_complete: "Event complete",
  delivered: "Final due",
  paid: "Paid in full",
  cancelled: "Cancelled",
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  zelle: "Zelle",
  cash: "Cash",
  check: "Check",
  other: "Other",
}

// steps the client sees; index = how many are done for each status
export const CLIENT_STEPS = ["Signed", "Date secured", "Event day", "Gallery delivered", "Paid in full"]
export const STEPS_DONE: Record<BookingStatus, number> = {
  draft: 0,
  sent: 0,
  signed: 1,
  booked: 2,
  event_complete: 3,
  delivered: 4,
  paid: 5,
  cancelled: 0,
}

export const EVENT_TYPES = [
  "Wedding",
  "Engagement",
  "Birthday",
  "Graduation",
  "Baby Shower",
  "Seemantham",
  "Half Saree",
  "Housewarming",
  "Corporate",
  "Portrait",
  "Automotive",
  "Real Estate",
  "Other",
]

export const ZELLE = "zelle@reactiveshots.com"
export const ZELLE_PHONE = "(972) 829-5173"

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadContract(number: string, preview = false) {
  const blob = await bookingsApi.contractPdf(number, preview)
  saveFile(blob, `${number}-agreement${preview ? "-draft" : ""}.pdf`)
}

export async function downloadInvoice(number: string, mine: boolean) {
  const blob = await bookingsApi.invoicePdf(number, mine)
  saveFile(blob, `Reactive Shots Studios Invoice INV-${number}.pdf`)
}
