import { isVideo, type Photo } from "@/lib/types"
import { apiFetch } from "@/lib/api"

const CDN = "https://aura-cdn.reactiveshots.com"
const BUCKET = "photoaura"
// pull the S3 key out of a thumbor-style URL: .../fit-in/WxH/[filters:.../]<key>
const THUMBOR = /\/fit-in\/\d+x\d+\/(?:filters:[^/]+\/)?(.+)$/

function b64(s: string) {
  return typeof window === "undefined"
    ? Buffer.from(s, "utf-8").toString("base64")
    : btoa(s)
}

// trigger a browser download by blobbing the bytes (CDN sends CORS *)
async function saveBlob(url: string, name: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const obj = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = obj
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(obj)
}

// navigate to a URL that already carries Content-Disposition: attachment
function navigateDownload(url: string) {
  const a = document.createElement("a")
  a.href = url
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Exact uploaded original. Goes through the API for a presigned S3 URL with a
 * download disposition — the CDN would otherwise re-encode to webp (browser
 * Accept negotiation) and hand back a "damaged" .jpg.
 */
export async function downloadOriginal(photo: Photo, slug?: string) {
  const name = photo.file_metadata.filename || "download"
  // derive the album slug from the image URL (key = "<slug>/<filename>")
  let albumSlug = slug
  if (!albumSlug) {
    const m = photo.image.match(THUMBOR)
    if (m) albumSlug = decodeURIComponent(m[1]).split("/")[0]
  }
  try {
    if (!albumSlug) throw new Error("no album slug")
    const { url } = await apiFetch<{ url: string }>(
      `/album/${albumSlug}/download/${encodeURIComponent(name)}`
    )
    navigateDownload(url)
  } catch {
    await saveBlob(photo.image, name).catch(() => window.open(photo.image, "_blank"))
  }
}

/**
 * Web-optimized copy: full frame, resized + forced to JPEG (never webp), handy
 * for quick sharing. Stills only.
 */
export async function downloadOptimized(photo: Photo) {
  const name = photo.file_metadata.filename || "download"
  if (isVideo(photo)) return
  const m = photo.image.match(THUMBOR)
  if (!m) return saveBlob(photo.image, name)
  const key = decodeURIComponent(m[1])
  const edits = { rotate: null, resize: { width: 2560, fit: "inside" }, toFormat: "jpeg" }
  const url = `${CDN}/${b64(JSON.stringify({ bucket: BUCKET, key, edits }))}`
  await saveBlob(url, name)
}

// kept for callers that just want "the good one"
export async function downloadPhoto(photo: Photo, slug?: string) {
  if (slug) return downloadOriginal(photo, slug)
  await saveBlob(photo.image, photo.file_metadata.filename || "download")
}
