"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ensureFreshToken } from "@/lib/auth-refresh"
import { Loader2, AlertCircle } from "lucide-react"

function Refresher() {
  const params = useSearchParams()
  const router = useRouter()
  // only ever a path on this site — never an absolute URL from the query
  const rawNext = params.get("next") || ""
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"
  const [offline, setOffline] = useState(false)
  const ran = useRef(false)

  const run = () => {
    setOffline(false)
    ensureFreshToken().then((outcome) => {
      if (outcome === "ok") router.replace(next)
      else if (outcome === "rejected") router.replace("/login")
      else setOffline(true)
    })
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <span className="mb-6 block h-px w-12 bg-brand" />
      {offline ? (
        <>
          <AlertCircle className="size-7 text-text-faint" />
          <h1 className="mt-4 font-heading text-2xl text-text-primary">Can&apos;t reach the server</h1>
          <p className="mt-2 max-w-sm text-sm font-light text-text-muted">
            You&apos;re still signed in. Check your connection and try again.
          </p>
          <button
            onClick={run}
            className="mt-6 border border-border-default px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <Loader2 className="size-7 animate-spin text-brand" />
          <h1 className="mt-4 font-heading text-2xl text-text-primary">Signing you back in</h1>
        </>
      )}
    </div>
  )
}

export default function RefreshPage() {
  return (
    <Suspense>
      <Refresher />
    </Suspense>
  )
}
