"use client"

import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import type { Photo } from "@/lib/types"

function formatBytes(n?: number) {
  if (!n || n <= 0) return null
  const mb = n / 1_048_576
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.round(n / 1024)} KB`
}

function formatDate(s?: string) {
  if (!s) return null
  // EXIF uses "YYYY:MM:DD HH:MM:SS"; normalise to something Date can parse
  const iso = /^\d{4}:\d{2}:\d{2}/.test(s)
    ? s.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T")
    : s
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v)
  if (Array.isArray(v) && v.length === 2) {
    const [a, b] = v.map(Number)
    if (b) return a / b
  }
  return null
}

// pull the camera fields people actually care about out of raw EXIF
function readExif(raw: Photo["file_metadata"]["exif_data"]) {
  let e: Record<string, unknown> = {}
  if (typeof raw === "string") {
    try {
      e = JSON.parse(raw)
    } catch {
      return []
    }
  } else if (raw && typeof raw === "object") {
    e = raw
  }

  const rows: { label: string; value: string }[] = []
  const make = String(e.Make ?? "").trim()
  const model = String(e.Model ?? "").trim()
  const camera = model.startsWith(make) ? model : [make, model].filter(Boolean).join(" ")
  if (camera) rows.push({ label: "Camera", value: camera })
  if (e.LensModel) rows.push({ label: "Lens", value: String(e.LensModel) })

  const iso = num(e.ISOSpeedRatings ?? e.PhotographicSensitivity)
  if (iso) rows.push({ label: "ISO", value: `ISO ${iso}` })

  const f = num(e.FNumber ?? e.ApertureValue)
  if (f) rows.push({ label: "Aperture", value: `ƒ/${f.toFixed(1).replace(/\.0$/, "")}` })

  const exp = num(e.ExposureTime)
  if (exp)
    rows.push({
      label: "Shutter",
      value: exp >= 1 ? `${exp}s` : `1/${Math.round(1 / exp)}s`,
    })

  const focal = num(e.FocalLength)
  if (focal) rows.push({ label: "Focal length", value: `${Math.round(focal)}mm` })

  const taken = formatDate(String(e.DateTimeOriginal ?? e.DateTime ?? ""))
  if (taken) rows.push({ label: "Taken", value: taken })

  return rows
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
        {label}
      </span>
      <span className="text-right text-sm text-text-primary">{value}</span>
    </div>
  )
}

type Props = {
  photo: Photo
  open: boolean
  onOpenChange: (open: boolean) => void
}

// in-lightbox drawer — deliberately NOT a Dialog, so it can't fight the
// lightbox's own keyboard/close handling (focus trap + Escape were exiting
// the viewer / jumping photos)
export function PhotoInfoPanel({ photo, open, onOpenChange }: Props) {
  const m = photo.file_metadata
  const exif = readExif(m.exif_data)
  const details = [
    m.width && m.height ? { label: "Dimensions", value: `${m.width} × ${m.height}` } : null,
    formatBytes(m.size) ? { label: "Size", value: formatBytes(m.size)! } : null,
    m.content_type ? { label: "Type", value: m.content_type } : null,
    formatDate(m.upload_date) ? { label: "Uploaded", value: formatDate(m.upload_date)! } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 z-30 flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto border-l border-border-subtle bg-surface"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="block h-px w-8 bg-brand" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                Info
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenChange(false)
              }}
              aria-label="Close info"
              className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-5 py-5">
            <h2 className="font-heading text-lg leading-tight tracking-tight text-text-primary break-all">
              {m.filename}
            </h2>
          </div>

          <div className="border-t border-border-subtle px-5 py-2">
            <div className="divide-y divide-border-subtle">
              {details.map((r) => (
                <Row key={r.label} {...r} />
              ))}
            </div>
          </div>

          {exif.length > 0 && (
            <div className="border-t border-border-subtle px-5 py-3">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.25em] text-text-faint">
                Camera
              </span>
              <div className="divide-y divide-border-subtle">
                {exif.map((r) => (
                  <Row key={r.label} {...r} />
                ))}
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
