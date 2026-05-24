"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import type { User, LoginResponse } from "@/lib/types"
import { toast } from "sonner"

type AuthContextType = {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

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
  const pathname = usePathname()

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

  const login = async (username: string, password: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"}/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.detail || "Login failed")
    }

    const loginData = data as LoginResponse
    setToken(loginData.access_token)
    setUser(loginData.user)
    setCookie("token", loginData.access_token, 3600)
    setCookie("user", JSON.stringify(loginData.user), 3600)
    toast.success(`Welcome back, ${loginData.user.full_name}!`)
    router.push("/dashboard")
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    deleteCookie("token")
    deleteCookie("user")
    router.push("/login")
  }

  return (
    <AuthContext value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
