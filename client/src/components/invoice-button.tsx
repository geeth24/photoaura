"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Download, Loader2 } from "lucide-react"
import { downloadInvoice } from "@/lib/bookings"
import { cn } from "@/lib/utils"

const outline =
  "flex items-center justify-center gap-2 whitespace-nowrap border border-border-default px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"

// the invoice is generated on request, so it always reflects the latest payments
export function InvoiceButton({
  number,
  mine,
  label = "Download invoice",
  className,
}: {
  number: string
  mine: boolean
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      await downloadInvoice(number, mine)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't download the invoice")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={download} disabled={busy} className={cn(outline, "h-10", className)}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {label}
    </button>
  )
}
