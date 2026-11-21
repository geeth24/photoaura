import type { LoginResponse, User } from "@/lib/types"

type Claims = { exp?: number; preview?: boolean; admin_id?: number }

export function claimsOf(jwt: string | null | undefined): Claims | null {
  if (!jwt) return null
  try {
    const part = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(part)) as Claims
  } catch {
    return null
  }
}

// cookie lifetime derived from the JWT's own expiry
export function maxAgeFor(jwt: string): number {
  const exp = claimsOf(jwt)?.exp
  return exp ? Math.max(60, exp - Math.floor(Date.now() / 1000)) : 3600
}

export function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`
}

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

export const REFRESH_COOKIE = "refresh_token"
const ADMIN_REFRESH_COOKIE = "admin_refresh_token"
const NINETY_DAYS = 90 * 24 * 60 * 60

export type RefreshGrant = { token: string; expiresIn: number }

export function grantOf(data: LoginResponse): RefreshGrant | undefined {
  return data.refresh_token
    ? { token: data.refresh_token, expiresIn: data.refresh_expires_in ?? NINETY_DAYS }
    : undefined
}

// no grant means the server doesn't do refresh tokens (or this is a preview),
// so a stale one must not linger
export function saveSession(token: string, user: User, maxAge = maxAgeFor(token), refresh?: RefreshGrant) {
  setCookie("token", token, maxAge)
  setCookie("user", JSON.stringify(user), maxAge)
  if (refresh) setCookie(REFRESH_COOKIE, refresh.token, refresh.expiresIn)
  else deleteCookie(REFRESH_COOKIE)
}

// signing out, or in, always drops any admin session kept aside for a preview
export function clearSession() {
  deleteCookie("token")
  deleteCookie("user")
  deleteCookie(REFRESH_COOKIE)
  dropAdminStash()
}

// every refresh token this browser holds, the stashed admin one included
export function heldRefreshTokens(): string[] {
  return [getCookie(REFRESH_COOKIE), getCookie(ADMIN_REFRESH_COOKIE)].filter((t): t is string => !!t)
}

const PREVIEW_FROM = "preview-from"

// the admin's own session waits in the same kind of cookie while the preview token is active
export function startPreviewSession(previewToken: string, previewUser: User) {
  const token = getCookie("token")
  const user = getCookie("user")
  const refresh = getCookie(REFRESH_COOKIE)
  let age: number | undefined
  if (user && !claimsOf(token)?.preview && (token || refresh)) {
    // the access token may run out mid-preview; the refresh token brings it back
    age = refresh ? NINETY_DAYS : maxAgeFor(token as string)
    if (token) setCookie("admin_token", token, maxAgeFor(token))
    setCookie("admin_user", user, age)
    if (refresh) setCookie(ADMIN_REFRESH_COOKIE, refresh, NINETY_DAYS)
  }
  try {
    sessionStorage.setItem(PREVIEW_FROM, window.location.pathname)
  } catch {}
  // the cookie outlives the 30-minute token so route gating doesn't bounce to
  // /login first; the first request after expiry puts the admin session back.
  // Previews never carry a refresh token.
  saveSession(previewToken, previewUser, age && Math.min(age, 2 * 60 * 60))
}

export function dropAdminStash() {
  deleteCookie("admin_token")
  deleteCookie("admin_user")
  deleteCookie(ADMIN_REFRESH_COOKIE)
}

export function inPreview(): boolean {
  return !!claimsOf(getCookie("token"))?.preview
}

// true when the admin session was put back. It only is while the current token
// is a preview minted by that same admin; anything else clears the stash.
export function restoreAdminSession(): boolean {
  const token = getCookie("admin_token")
  const user = getCookie("admin_user")
  const refresh = getCookie(ADMIN_REFRESH_COOKIE)
  dropAdminStash()
  const exp = claimsOf(token)?.exp
  const tokenLive = !!token && !!exp && exp * 1000 > Date.now()
  if (!user || (!tokenLive && !refresh)) return false
  let admin: User
  try {
    admin = JSON.parse(user) as User
  } catch {
    return false
  }
  const current = claimsOf(getCookie("token"))
  if (!current?.preview || current.admin_id !== admin.id) return false
  const grant = refresh ? { token: refresh, expiresIn: NINETY_DAYS } : undefined
  if (tokenLive) {
    saveSession(token as string, admin, undefined, grant)
  } else {
    // the admin's access token lapsed during the preview; the next request refreshes it
    deleteCookie("token")
    setCookie("user", JSON.stringify(admin), NINETY_DAYS)
    setCookie(REFRESH_COOKIE, refresh as string, NINETY_DAYS)
  }
  return true
}

export function previewReturnPath(): string {
  try {
    const from = sessionStorage.getItem(PREVIEW_FROM)
    sessionStorage.removeItem(PREVIEW_FROM)
    if (from && from.startsWith("/")) return from
  } catch {}
  return "/dashboard"
}
