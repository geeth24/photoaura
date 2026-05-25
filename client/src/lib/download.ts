import { isVideo, type Photo } from "@/lib/types"

const CDN = "https://aura-cdn.reactiveshots.com"

// the full-quality source: raw original for photos, presigned file for videos
function originalUrl(photo: Photo): string {
  if (isVideo(photo)) return photo.image
  const m = photo.image.match(/\/fit-in\/\d+x\d+\/(.+)$/)
  return m ? `${CDN}/${m[1]}` : photo.image
}

export async function downloadPhoto(photo: Photo) {
  const url = originalUrl(photo)
  const name = photo.file_metadata.filename || "download"
  try {
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
  } catch {
    window.open(url, "_blank")
  }
}
