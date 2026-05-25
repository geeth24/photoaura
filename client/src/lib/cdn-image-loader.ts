// Custom next/image loader: serve images straight from the SIH/CloudFront CDN.
//
// Uses SIH's base64 "edits" request so we can auto-orient (rotate: null applies
// the EXIF rotation to the pixels and strips it) — the Thumbor /fit-in/ URLs the
// API returns do NOT bake in rotation, so portrait photos came out sideways.
// We also resize per requested width; AutoWebP is negotiated via the Accept header.
//
// Non-CDN sources (local /images, raw face/video keys) pass through unchanged.

type LoaderArgs = { src: string; width: number; quality?: number }

const CDN = "https://aura-cdn.reactiveshots.com"
const BUCKET = "photoaura"
// pull the S3 key out of a thumbor-style URL: .../fit-in/720x0/[filters:.../]<key>
const THUMBOR = /\/fit-in\/\d+x0\/(?:filters:[^/]+\/)?(.+)$/

function b64(s: string): string {
  return typeof window === "undefined"
    ? Buffer.from(s, "utf-8").toString("base64")
    : btoa(s)
}

export default function cdnImageLoader({ src, width, quality }: LoaderArgs): string {
  const m = src.match(THUMBOR)
  if (!m) return src
  const key = decodeURIComponent(m[1])
  const edits: Record<string, unknown> = {
    rotate: null, // auto-orient from EXIF, then strip
    resize: { width, fit: "inside" },
  }
  if (quality) {
    edits.webp = { quality }
    edits.jpeg = { quality }
  }
  return `${CDN}/${b64(JSON.stringify({ bucket: BUCKET, key, edits }))}`
}
