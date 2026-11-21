"use client"

import { Eye } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { Switch } from "@/components/ui/switch"

// stays on top while an admin is looking at the app as a client
export function PreviewBanner() {
  const { user, isPreview, showAsPaid, setShowAsPaid, exitPreview } = useAuth()
  if (!isPreview || !user) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-brand/40 bg-surface-elevated px-5 py-2 sm:px-8"
    >
      <p className="flex min-w-0 items-center gap-2 text-[13px] text-text-primary">
        <Eye className="size-3.5 shrink-0 text-brand" />
        <span className="min-w-0">
          Viewing as <span className="font-medium">{user.full_name}</span>
          <span className="text-text-muted"> — read-only · </span>
          <button
            type="button"
            onClick={exitPreview}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Exit preview
          </button>
        </span>
      </p>
      <label className="flex cursor-pointer items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary">
        <Switch size="sm" checked={showAsPaid} onCheckedChange={setShowAsPaid} />
        Show as paid
      </label>
    </div>
  )
}
