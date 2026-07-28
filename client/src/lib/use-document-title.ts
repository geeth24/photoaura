"use client"

import { useEffect } from "react"

// the dashboard pages are client-rendered, so they can't export metadata —
// set the browser-tab title here instead. Falsy title = leave it alone (still loading).
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} · PhotoAura`
    return () => {
      document.title = prev
    }
  }, [title])
}
