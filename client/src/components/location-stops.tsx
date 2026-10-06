"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapPin, Plus, X, ExternalLink, Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { apiBlob, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

type Suggestion = { place_id: string; text: string; main: string; secondary: string }
type Place = { label: string }

type Props = {
  value: string // stops, one per line
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  className?: string
}

const newSession = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()))

export function mapsLink(stops: string[]) {
  const real = stops.map((s) => s.trim()).filter(Boolean)
  if (real.length <= 1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(real[0] ?? "")}`
  const dest = real[real.length - 1]
  const waypoints = real.slice(0, -1).join("|")
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&waypoints=${encodeURIComponent(waypoints)}`
}

function StopInput({
  value,
  onChange,
  onPicked,
  disabled,
  invalid,
  className,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onPicked: () => void
  disabled?: boolean
  invalid?: boolean
  className?: string
  placeholder: string
}) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const session = useRef(newSession())
  const typed = useRef(false) // only suggest after the user types, not on load

  useEffect(() => {
    const q = value.trim()
    if (!typed.current || q.length < 3) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiFetch<Suggestion[]>(
          `/places/autocomplete?q=${encodeURIComponent(q)}&session=${session.current}`
        )
        if (!cancelled) {
          setItems(res)
          setActive(0)
          setOpen(res.length > 0)
        }
      } catch {
        if (!cancelled) setOpen(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [value])

  async function pick(s: Suggestion) {
    setOpen(false)
    typed.current = false
    onChange(s.text)
    try {
      const p = await apiFetch<Place>(`/places/${encodeURIComponent(s.place_id)}?session=${session.current}`)
      onChange(p.label)
    } catch {
      // the suggestion text is already a usable address
    }
    session.current = newSession()
    onPicked()
  }

  return (
    <div className="relative flex-1">
      <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className={cn(className, "pl-9 pr-9")}
        onChange={(e) => {
          typed.current = true
          onChange(e.target.value)
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150)
          onPicked()
        }}
        onKeyDown={(e) => {
          if (!open || !items.length) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => (a + 1) % items.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => (a - 1 + items.length) % items.length)
          } else if (e.key === "Enter") {
            e.preventDefault()
            pick(items[active])
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-text-muted" />}
      {open && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 border border-border-default bg-surface-elevated shadow-xl" role="listbox">
          {items.map((s, i) => (
            <li key={s.place_id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
                  i === active ? "bg-surface-hover" : "bg-transparent"
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text-primary">{s.main || s.text}</span>
                  {s.secondary && <span className="block truncate text-xs text-text-muted">{s.secondary}</span>}
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-right text-[10px] text-text-faint">Powered by Google</li>
        </ul>
      )}
    </div>
  )
}

export function LocationStops({ value, onChange, disabled, invalid, className }: Props) {
  const stops = useMemo(() => {
    const lines = value.split("\n")
    return lines.length ? lines : [""]
  }, [value])
  // the map follows committed stops (picked or left), not every keystroke
  const [committed, setCommitted] = useState(() => stops.map((s) => s.trim()).filter(Boolean))
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [mapState, setMapState] = useState<"idle" | "loading" | "error">("idle")

  const set = (i: number, v: string) => onChange(stops.map((s, j) => (j === i ? v : s)).join("\n"))
  const commit = () => setCommitted(stops.map((s) => s.trim()).filter(Boolean))
  const key = committed.join("\n")

  const mapStops = useMemo(() => (key ? key.split("\n").filter((s) => s.length > 5) : []), [key])

  useEffect(() => {
    if (!mapStops.length) return
    let url: string | null = null
    let cancelled = false
    const t = setTimeout(async () => {
      setMapState("loading")
      try {
        const qs = mapStops.map((s) => `stops=${encodeURIComponent(s)}`).join("&")
        const blob = await apiBlob(`/maps/static.png?${qs}&w=640&h=240`)
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setMapUrl(url)
        setMapState("idle")
      } catch {
        if (!cancelled) setMapState("error")
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
      if (url) URL.revokeObjectURL(url)
    }
  }, [mapStops])

  return (
    <div className="space-y-2">
      {stops.map((stop, i) => (
        <div key={i} className="flex items-center gap-2">
          {stops.length > 1 && (
            <span className="flex size-6 shrink-0 items-center justify-center bg-brand text-[11px] font-semibold text-surface">{i + 1}</span>
          )}
          <StopInput
            value={stop}
            onChange={(v) => set(i, v)}
            onPicked={commit}
            disabled={disabled}
            invalid={invalid && i === 0}
            className={className}
            placeholder={i === 0 ? "Venue or address" : "Next stop, e.g. reception hall"}
          />
          {stops.length > 1 && !disabled && (
            <button
              type="button"
              aria-label={`Remove stop ${i + 1}`}
              onClick={() => {
                const next = stops.filter((_, j) => j !== i)
                onChange(next.join("\n"))
                setCommitted(next.map((s) => s.trim()).filter(Boolean))
              }}
              className="flex size-10 shrink-0 items-center justify-center border border-border-default text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!disabled && stops.length < 6 && (
          <button
            type="button"
            onClick={() => onChange([...stops, ""].join("\n"))}
            className="flex h-8 items-center gap-1.5 border border-border-default px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Plus className="size-3.5" /> Add stop
          </button>
        )}
        {committed.length > 0 && (
          <a
            href={mapsLink(committed)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-brand hover:underline"
          >
            {committed.length > 1 ? "Route in Google Maps" : "Open in Google Maps"} <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {mapStops.length > 0 && (mapUrl || mapState === "loading") && (
        <div className="relative aspect-[640/240] w-full overflow-hidden border border-border-subtle bg-surface-elevated">
          {mapUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapUrl} alt="Map of the event locations" className={cn("size-full object-cover transition-opacity", mapState === "loading" && "opacity-50")} />
          )}
          {mapState === "loading" && !mapUrl && <div className="absolute inset-0 animate-pulse bg-surface-hover" />}
        </div>
      )}
    </div>
  )
}
