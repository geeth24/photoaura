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

export function clearSession() {
  for (const name of ["token", "user", "admin_token", "admin_user"]) deleteCookie(name)
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

// true when the admin session was put back; false when it expired meanwhile
export function restoreAdminSession(): boolean {
  const token = getCookie("admin_token")
  const user = getCookie("admin_user")
  deleteCookie("admin_token")
  deleteCookie("admin_user")
  const exp = claimsOf(token)?.exp
  if (!token || !user || !exp || exp * 1000 <= Date.now()) return false
  saveSession(token, JSON.parse(user) as User)
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
