import type { User } from "@/lib/types"

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

export function saveSession(token: string, user: User, maxAge = maxAgeFor(token)) {
  setCookie("token", token, maxAge)
  setCookie("user", JSON.stringify(user), maxAge)
}

// signing out, or in, always drops any admin session kept aside for a preview
export function clearSession() {
  deleteCookie("token")
  deleteCookie("user")
  dropAdminStash()
}

const PREVIEW_FROM = "preview-from"

// the admin's own session waits in the same kind of cookie while the preview token is active
export function startPreviewSession(previewToken: string, previewUser: User) {
  const token = getCookie("token")
  const user = getCookie("user")
  let age: number | undefined
  if (token && user && !claimsOf(token)?.preview) {
    age = maxAgeFor(token)
    setCookie("admin_token", token, age)
    setCookie("admin_user", user, age)
  }
  try {
    sessionStorage.setItem(PREVIEW_FROM, window.location.pathname)
  } catch {}
  // the cookie outlives the 30-minute token so route gating doesn't bounce to
  // /login first; the first request after expiry puts the admin session back
  saveSession(previewToken, previewUser, age)
}

export function dropAdminStash() {
  deleteCookie("admin_token")
  deleteCookie("admin_user")
}

export function inPreview(): boolean {
  return !!claimsOf(getCookie("token"))?.preview
}

// true when the admin session was put back. It only is while the current token
// is a preview minted by that same admin; anything else clears the stash.
export function restoreAdminSession(): boolean {
  const token = getCookie("admin_token")
  const user = getCookie("admin_user")
  dropAdminStash()
  const exp = claimsOf(token)?.exp
  if (!token || !user || !exp || exp * 1000 <= Date.now()) return false
  let admin: User
  try {
    admin = JSON.parse(user) as User
  } catch {
    return false
  }
  const current = claimsOf(getCookie("token"))
  if (!current?.preview || current.admin_id !== admin.id) return false
  saveSession(token, admin)
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
