"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

// emails the person a one-tap sign-in link
export function SendLinkButton({ userId, className }: { userId: number; className?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const send = async () => {
    setState("sending")
    try {
      await apiFetch(`/users/${userId}/notify`, { method: "POST", body: JSON.stringify({ kind: "login_link" }) })
      toast.success("Login link sent")
      setState("sent")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send link")
      setState("idle")
    }
  }
  return (
    <button
      onClick={send}
      disabled={state === "sending"}
      title="Email a login link"
      className={cn(
        "relative z-10 flex h-9 shrink-0 items-center gap-1.5 border border-border-default px-3 text-[10px] font-medium uppercase tracking-[0.15em] text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:opacity-60",
        className,
      )}
    >
      <Send className="size-3.5" />
      {state === "sending" ? "Sending…" : state === "sent" ? "Sent" : "Send link"}
    </button>
  )
}
