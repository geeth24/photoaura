"use client"

import { useState } from "react"
import { motion } from "motion/react"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function LoginPage() {
  const [mode, setMode] = useState<"magic" | "password">("magic")
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { login, requestMagicLink } = useAuth()

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await requestMagicLink(email.trim())
      setSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send link")
    } finally {
      setLoading(false)
    }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* brand panel */}
      <div className="grain relative hidden overflow-hidden bg-surface-elevated lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand/20 blur-[140px]" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-brand/10 blur-[160px]" />

        <div className="relative z-10 flex items-center gap-3">
          <Image src="/images/logo.png" alt="PhotoAura" width={36} height={36} />
          <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-text-muted">
            PhotoAura
          </span>
        </div>

        <div className="relative z-10">
          <div className="mb-6 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Studio Suite
            </span>
          </div>
          <h2 className="font-heading text-[clamp(2.5rem,5vw,4rem)] leading-[0.95] tracking-tight text-text-primary">
            Your photos,
            <br />
            <span className="text-brand">beautifully</span> managed.
          </h2>
          <p className="mt-6 max-w-sm text-[15px] font-light leading-[1.8] text-text-secondary">
            Galleries, faces, and uploads — everything your studio ships, in one
            quiet place.
          </p>
        </div>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center px-6 py-16 sm:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image src="/images/logo.png" alt="PhotoAura" width={32} height={32} />
            <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-text-muted">
              PhotoAura
            </span>
          </div>

          <div className="mb-8 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Studio Access
            </span>
          </div>

          <h1 className="font-heading text-4xl tracking-tight text-text-primary">
            Welcome back
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            {mode === "magic"
              ? "Enter your email and we'll send a secure sign-in link."
              : "Sign in with your studio credentials."}
          </p>

          {mode === "magic" ? (
            sent ? (
              <div className="mt-10 border border-border-default p-6">
                <p className="font-heading text-xl text-text-primary">Check your inbox</p>
                <p className="mt-2 text-sm font-light text-text-muted">
                  If <span className="text-text-secondary">{email}</span> has access, a
                  sign-in link is on its way. It expires in 30 minutes.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagic} className="mt-10 space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="h-11 bg-surface-elevated"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2 bg-brand text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Email me a link"}
                  {!loading && (
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  )}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handlePassword} className="mt-10 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
                >
                  Username
                </label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="h-11 bg-surface-elevated"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="h-11 bg-surface-elevated"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 bg-brand text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && (
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                )}
              </button>
            </form>
          )}

          <button
            onClick={() => {
              setMode(mode === "magic" ? "password" : "magic")
              setSent(false)
            }}
            className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary"
          >
            {mode === "magic" ? "Sign in with password" : "Use a magic link instead"}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
