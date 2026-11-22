import type { Photo } from "@/lib/types"

// capture time from EXIF, read as the camera's local time
export function takenAt(p: Photo): Date | null {
  let raw: unknown = p.file_metadata.exif_data
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
      if (typeof raw === "string") raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  const e = (raw ?? {}) as Record<string, unknown>
  const s = String(e.DateTimeOriginal ?? e.DateTime ?? "")
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  return isNaN(d.getTime()) ? null : d
}
