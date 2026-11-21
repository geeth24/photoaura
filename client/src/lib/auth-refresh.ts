import type { LoginResponse } from "@/lib/types"
import {
  REFRESH_COOKIE,
  claimsOf,
  clearSession,
  getCookie,
  grantOf,
  heldRefreshTokens,
  inPreview,
  saveSession,
} from "@/lib/session"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

// refresh once the access token has under this long left
const REFRESH_WITHIN_SECONDS = 5 * 60

// ok: new cookies are in place. rejected: the server refused, so the session
// is over. unavailable: couldn't reach it; keep the session and try later.
export type RefreshOutcome = "ok" | "rejected" | "unavailable"

type Listener = (data: LoginResponse) => void
const listeners = new Set<Listener>()

// lets the auth context follow refreshes that happen inside apiFetch
export function onSessionRefreshed(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function canRefresh(): boolean {
  // a preview token is never refreshed; its 401 means the preview ended
  return !!getCookie(REFRESH_COOKIE) && !inPreview()
}

let inflight: Promise<RefreshOutcome> | null = null

// one refresh at a time; callers that arrive meanwhile wait on the same one
export function refreshSession(): Promise<RefreshOutcome> {
  if (!canRefresh()) return Promise.resolve("rejected")
  const sent = getCookie(REFRESH_COOKIE) as string
  inflight ??= withTabLock(() => rotate(sent)).finally(() => {
    inflight = null
  })
  return inflight
}

// refresh tokens are single use, so two tabs spending the same one would look
// like theft and sign everyone out
function withTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined
  return locks ? (locks.request("photoaura-refresh", fn) as Promise<T>) : fn()
}

async function rotate(sent: string): Promise<RefreshOutcome> {
  const current = getCookie(REFRESH_COOKIE)
  if (!current) return "rejected"
  // another tab got there first while this one waited for the lock
  if (current !== sent) return "ok"

  let res: Response
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current }),
      cache: "no-store",
    })
  } catch {
    return "unavailable"
  }
  if (res.status === 401) {
    clearSession()
    return "rejected"
  }
  if (!res.ok) return "unavailable"

  const data = (await res.json()) as LoginResponse
  saveSession(data.access_token, data.user, undefined, grantOf(data))
  listeners.forEach((fn) => fn(data))
  return "ok"
}

// true when the access cookie is gone or about to be
export function accessTokenStale(): boolean {
  const exp = claimsOf(getCookie("token"))?.exp
  return !exp || exp - Date.now() / 1000 < REFRESH_WITHIN_SECONDS
}

// call before a request: refreshes early so it doesn't have to fail first
export async function ensureFreshToken(): Promise<RefreshOutcome> {
  if (!canRefresh() || !accessTokenStale()) return "ok"
  return refreshSession()
}

// best effort; never blocks sign out for long
export async function revokeRefreshTokens() {
  await Promise.all(
    heldRefreshTokens().map((refresh_token) =>
      fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => {}),
    ),
  )
}
