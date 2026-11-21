import type { ReelAspect } from "@/lib/types"

export function reelShape(aspect: ReelAspect) {
  return aspect === "9:16" ? "Vertical" : "Horizontal"
}

export function reelLength(seconds: number | null | undefined) {
  if (!seconds) return ""
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function reelBox(aspect: ReelAspect) {
  return aspect === "9:16" ? "aspect-[9/16]" : "aspect-video"
}
