"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { Loader2, AlertCircle } from "lucide-react"

function Verifier() {
  const params = useSearchParams()
  const router = useRouter()
  const { verifyMagic } = useAuth()
  const token = params.get("token")
  const [error, setError] = useState<string | null>(
    token ? null : "Missing sign-in link."
  )
  const ran = useRef(false)

  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true
    verifyMagic(token)
      .then((user) =>
        router.replace(user.role === "client" ? "/albums" : "/dashboard")
      )
      .catch((e) => setError(e instanceof Error ? e.message : "Sign-in failed."))
  }, [token, router, verifyMagic])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <span className="mb-6 block h-px w-12 bg-brand" />
      {error ? (
        <>
          <AlertCircle className="size-7 text-text-faint" />
          <h1 className="mt-4 font-heading text-2xl text-text-primary">
            Link didn&apos;t work
          </h1>
          <p className="mt-2 max-w-sm text-sm font-light text-text-muted">{error}</p>
          <Link
            href="/login"
            className="mt-6 border border-border-default px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Request a new link
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="size-7 animate-spin text-brand" />
          <h1 className="mt-4 font-heading text-2xl text-text-primary">Signing you in</h1>
          <p className="mt-2 text-sm font-light text-text-muted">One moment…</p>
        </>
      )}
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verifier />
    </Suspense>
  )
}
