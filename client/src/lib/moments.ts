import type { Moment } from "@/lib/types"

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
const stamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

// the ISO strings carry no offset, so they parse as local and print as the camera saw them
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

export function spansDays(moments: Pick<Moment, "start" | "end">[]) {
  return new Set(moments.flatMap((m) => [new Date(m.start).toDateString(), new Date(m.end).toDateString()])).size > 1
}

export function momentRange(m: Pick<Moment, "start" | "end">, withDate: boolean) {
  const a = new Date(m.start)
  const b = new Date(m.end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ""
  return (withDate || !sameDay(a, b) ? stamp : clock).formatRange(a, b)
}
