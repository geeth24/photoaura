export function fmtBytes(n: number | null | undefined): string {
  if (!n) return "0 B"
  const u = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1)
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

export function initialsOf(name: string | null | undefined) {
  return (name ?? "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const DAY = 86_400_000

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// whole calendar days from today; negative is the past
export function daysFromToday(d: Date, now = new Date()) {
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY)
}

// "today", "3 days ago", "in 5 days", then a plain date once it's far off
export function relativeDay(iso: string | Date | null | undefined, now = new Date()) {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  const n = daysFromToday(d, now)
  if (n === 0) return "today"
  if (n === -1) return "yesterday"
  if (n === 1) return "tomorrow"
  if (n < 0 && n > -30) return `${-n} days ago`
  if (n > 0 && n < 30) return `in ${n} days`
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
