"use client"

import { useAuth } from "@/context/auth-context"
import { LogOut } from "lucide-react"

export default function ProfilePage() {
  const { user, logout } = useAuth()

  return (
    <div className="mx-auto max-w-2xl space-y-12">
      <div>
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Account
          </span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          {user?.full_name || "Profile"}
        </h1>
        <p className="mt-3 text-sm font-light text-text-secondary">
          {user?.role === "client" ? "Client" : "Studio admin"}
        </p>
      </div>

      <div className="divide-y divide-border-subtle border border-border-subtle">
        {[
          { label: "Name", value: user?.full_name },
          { label: "Email", value: user?.user_email },
          { label: "Role", value: user?.role === "client" ? "Client" : "Admin" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
              {row.label}
            </span>
            <span className="text-sm text-text-primary">{row.value || "—"}</span>
          </div>
        ))}
      </div>

      <button
        onClick={logout}
        className="flex h-11 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-destructive/50 hover:text-destructive"
      >
        <LogOut className="size-3.5" />
        Sign out
      </button>
    </div>
  )
}
