"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { User, LoginResponse } from "@/lib/types"
import { toast } from "sonner"

type AuthContextType = {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  requestMagicLink: (email: string) => Promise<void>
  verifyMagic: (linkToken: string) => Promise<User>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

// cookie lifetime derived from the JWT's own expiry
function maxAgeFor(jwt: string): number {
  try {
    const exp = JSON.parse(atob(jwt.split(".")[1])).exp as number
    return Math.max(60, exp - Math.floor(Date.now() / 1000))
  } catch {
    return 3600
  }
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const savedToken = getCookie("token")
    const savedUser = getCookie("user")

    if (savedToken && savedUser) {
      try {
        const decoded = JSON.parse(atob(savedToken.split(".")[1]))
        if (decoded.exp * 1000 > Date.now()) {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
        } else {
          deleteCookie("token")
          deleteCookie("user")
        }
      } catch {
        deleteCookie("token")
        deleteCookie("user")
      }
    }
    setIsLoading(false)
  }, [])

  const setSession = (data: LoginResponse) => {
    const age = maxAgeFor(data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    setCookie("token", data.access_token, age)
    setCookie("user", JSON.stringify(data.user), age)
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

  const logout = () => {
    setUser(null)
    setToken(null)
    deleteCookie("token")
    deleteCookie("user")
    router.push("/login")
  }

  return (
    <AuthContext value={{ user, token, login, requestMagicLink, verifyMagic, logout, isLoading }}>
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
