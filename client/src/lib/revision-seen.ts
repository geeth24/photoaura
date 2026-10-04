// last revision number a viewer has opened, per album. only a hint for the
// home screen marker, so blocked storage just means the marker stays up.
const key = (slug: string) => `pa:revision-seen:${slug}`

export function seenRevision(slug: string): number {
  try {
    return Number(localStorage.getItem(key(slug))) || 0
  } catch {
    return 0
  }
}

export function markRevisionSeen(slug: string, number: number) {
  try {
    if (seenRevision(slug) < number) localStorage.setItem(key(slug), String(number))
  } catch {
    // private mode / blocked storage
  }
}
