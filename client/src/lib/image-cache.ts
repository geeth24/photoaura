// Remembers which image URLs have already loaded once (persisted in
// localStorage). The bytes are already browser-cached (CDN sends max-age 1y),
// so on reload a "seen" image can skip the blur placeholder and pop straight in
// from cache instead of fading from blur every time.

const KEY = "pa-seen-img"
const CAP = 8000 // keep the store bounded
let seen: Set<string> | null = null
let pending: ReturnType<typeof setTimeout> | null = null

function load(): Set<string> {
  if (seen) return seen
  try {
    seen = new Set<string>(JSON.parse(localStorage.getItem(KEY) || "[]"))
  } catch {
    seen = new Set<string>()
  }
  return seen
}

export function hasSeenImage(src?: string | null): boolean {
  if (typeof window === "undefined" || !src) return false
  return load().has(src)
}

export function markImageSeen(src?: string | null): void {
  if (typeof window === "undefined" || !src) return
  const s = load()
  if (s.has(src)) return
  s.add(src)
  // debounce the write so we don't re-serialize on every onLoad
  if (pending) return
  pending = setTimeout(() => {
    pending = null
    try {
      localStorage.setItem(KEY, JSON.stringify([...load()].slice(-CAP)))
    } catch {
      // storage full / disabled — fine, it's just an optimization
    }
  }, 800)
}
