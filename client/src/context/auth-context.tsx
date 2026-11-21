"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { User, LoginResponse } from "@/lib/types"
import { apiFetch, startPreviewRequest } from "@/lib/api"
import { canRefresh, ensureFreshToken, onSessionRefreshed, revokeRefreshTokens } from "@/lib/auth-refresh"
import {
  claimsOf,
  clearSession,
  getCookie,
  grantOf,
  deleteCookie,
  dropAdminStash,
  inPreview,
  maxAgeFor,
  previewReturnPath,
  restoreAdminSession,
  saveSession,
  setCookie,
  startPreviewSession,
} from "@/lib/session"
import { toast } from "sonner"

type AuthContextType = {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  requestMagicLink: (email: string) => Promise<void>
  verifyMagic: (linkToken: string) => Promise<User>
  logout: () => Promise<void>
  isLoading: boolean
  // an admin looking at the app as one client, read-only
  isPreview: boolean
  showAsPaid: boolean
  setShowAsPaid: (on: boolean) => void
  startPreview: (userId: number) => Promise<void>
  exitPreview: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

function leavePreview() {
  // another tab may already have exited; its restored admin session must survive
  if (!inPreview()) {
    window.location.assign(previewReturnPath())
  } else if (restoreAdminSession()) {
    window.location.assign(previewReturnPath())
  } else {
    clearSession()
    window.location.assign("/login")
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAsPaid, setShowAsPaid] = useState(false)
  const router = useRouter()
  const isPreview = !!claimsOf(token)?.preview

  useEffect(() => {
    const savedToken = getCookie("token")
    const savedUser = getCookie("user")
    const dropSession = () => {
      deleteCookie("token")
      deleteCookie("user")
    }
    // a preview that ran out of time hands the admin session back
    const backToAdmin = () => {
      const restored = restoreAdminSession()
      if (restored) window.location.replace(previewReturnPath())
      return restored
    }
    // the access token is gone, expired or nearly so: trade the refresh token
    // for a new one. A failure has already cleared the session.
    const renew = () =>
      ensureFreshToken().then((outcome) => {
        const fresh = getCookie("token")
        const freshUser = getCookie("user")
        if (outcome === "ok" && fresh && freshUser) {
          setToken(fresh)
          setUser(JSON.parse(freshUser))
        }
        setIsLoading(false)
      })
    const decoded = claimsOf(savedToken)
    const live = !!decoded?.exp && decoded.exp * 1000 > Date.now()

    if (!live && canRefresh()) {
      renew()
      return
    }

    if (savedToken && savedUser) {
      try {
        if (live && decoded?.exp) {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
          // refresh from the server so role/name changes (e.g. promoted to
          // admin) take effect without forcing a re-login
          apiFetch<User>("/me")
            .then((fresh) => {
              // same user, same object, so effects keyed on it don't refetch
              setUser((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh))
              // read the cookie again: this request may have refreshed the session
              setCookie("user", JSON.stringify(fresh), maxAgeFor(getCookie("token") ?? savedToken))
            })
            .catch(() => {})
        } else {
          // restore first: it needs the expired preview token still in place
          if (!backToAdmin()) dropSession()
        }
      } catch {
        dropSession()
      }
    } else {
      backToAdmin()
    }
    setIsLoading(false)
  }, [])

  const setSession = (data: LoginResponse) => {
    dropAdminStash()
    setToken(data.access_token)
    setUser(data.user)
    saveSession(data.access_token, data.user, undefined, grantOf(data))
  }

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || "Login failed")
    setSession(data as LoginResponse)
    toast.success(`Welcome back, ${data.user.full_name}!`)
    router.push(data.user.role === "client" ? "/albums" : "/dashboard")
  }

  const requestMagicLink = async (email: string) => {
    const res = await fetch(`${API_BASE}/auth/request-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || "Could not send the link")
    }
  }

  const verifyMagic = async (linkToken: string): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/verify-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: linkToken }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || "This link is invalid or expired.")
    setSession(data as LoginResponse)
    return (data as LoginResponse).user
  }

  const startPreview = async (userId: number) => {
    const data = await startPreviewRequest(userId)
    startPreviewSession(data.access_token, data.user)
    // full load so nothing from the admin session lingers in memory
    window.location.assign("/albums")
  }

  useEffect(() => {
    const exp = claimsOf(token)?.exp
    if (!isPreview || !exp) return
    // setTimeout overflows past ~24 days; a real preview token is far shorter
    const timer = setTimeout(leavePreview, Math.min(Math.max(0, exp * 1000 - Date.now()), 2 ** 31 - 1))
    return () => clearTimeout(timer)
  }, [isPreview, token])

  // follows refreshes that happen inside apiFetch
  useEffect(
    () =>
      onSessionRefreshed((data) => {
        setToken(data.access_token)
        // same user, same object, so effects keyed on it don't refetch
        setUser((prev) => (JSON.stringify(prev) === JSON.stringify(data.user) ? prev : data.user))
      }),
    [],
  )

  // signs out of everything, including an admin session kept aside for a preview
  const logout = async () => {
    await revokeRefreshTokens()
    setUser(null)
    setToken(null)
    clearSession()
    router.push("/login")
  }

  // another tab entering or leaving a preview makes this one stale
  useEffect(() => {
    const onFocus = () => {
      if (!!token && inPreview() !== isPreview) window.location.reload()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [token, isPreview])

  return (
    <AuthContext
      value={{
        user,
        token,
        login,
        requestMagicLink,
        verifyMagic,
        logout,
        isLoading,
        isPreview,
        showAsPaid,
        setShowAsPaid,
        startPreview,
        exitPreview: leavePreview,
      }}
    >
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

// share pages render the same viewers without a provider, so this never throws
export function usePreview() {
  const context = useContext(AuthContext)
  return { isPreview: context?.isPreview ?? false, showAsPaid: context?.showAsPaid ?? false }
}
