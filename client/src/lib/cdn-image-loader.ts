// Custom next/image loader: serve images straight from the SIH/CloudFront CDN
// (Thumbor URLs) instead of re-optimizing through the Next.js image optimizer.
// next/image asks for a given width; we rewrite the CDN URL to that width and
// let the CDN's AutoWebP serve WebP based on the browser's Accept header.
//
// Non-CDN sources (local /images, raw face/video keys) pass through unchanged.

type LoaderArgs = { src: string; width: number; quality?: number }

const THUMBOR = /^(https?:\/\/[^/]+)\/fit-in\/\d+x0\/(?:filters:[^/]+\/)?(.+)$/

export default function cdnImageLoader({ src, width, quality }: LoaderArgs): string {
  const m = src.match(THUMBOR)
  if (!m) return src
  const [, host, path] = m
  const q = quality ?? 80
  return `${host}/fit-in/${width}x0/filters:quality(${q})/${path}`
}
