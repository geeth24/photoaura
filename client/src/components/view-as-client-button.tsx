"use client"

import { useState } from "react"
import { Eye, Loader2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// admin entry point: open the app as this client, read-only
export function ViewAsClientButton({
  userId,
  className,
  compact = false,
}: {
  userId: number
  className?: string
  // icon only on phones, where a row has little room
  compact?: boolean
}) {
  const { startPreview } = useAuth()
  const [busy, setBusy] = useState(false)

  const open = async () => {
    setBusy(true)
    try {
      await startPreview(userId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the preview")
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      aria-label="View as client"
      title="See the app exactly as this client does, read-only"
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 border border-border-default px-3 text-[10px] font-medium uppercase tracking-[0.15em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-50",
        compact && "max-sm:w-9 max-sm:justify-center max-sm:px-0",
        className,
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
      <span className={cn(compact && "max-sm:hidden")}>View as client</span>
    </button>
  )
}
