"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import { LogOut, Plus, X, Check, Clock } from "lucide-react"
import { toast } from "sonner"

type Email = {
  id: number
  email: string
  verified_at: string | null
  is_primary: boolean
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const [emails, setEmails] = useState<Email[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)

  const fetchEmails = useCallback(() => {
    apiFetch<Email[]>("/me/emails")
      .then(setEmails)
      .catch(() => setEmails([]))
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim() || adding) return
    setAdding(true)
    try {
      await apiFetch("/me/emails", {
        method: "POST",
        body: JSON.stringify({ email: newEmail.trim() }),
      })
      toast.success("Verification email sent — check that inbox.")
      setNewEmail("")
      fetchEmails()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add email")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: number) => {
    try {
      await apiFetch(`/me/emails/${id}`, { method: "DELETE" })
      toast.success("Email removed")
      fetchEmails()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove")
    }
  }

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

      {/* emails */}
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Email addresses
          </span>
        </div>

        <div className="divide-y divide-border-subtle border border-border-subtle">
          {emails.length === 0 ? (
            <div className="px-5 py-6 text-sm font-light text-text-muted">
              Loading…
            </div>
          ) : (
            emails.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-sm text-text-primary">{e.email}</span>
                  {e.is_primary && (
                    <span className="shrink-0 border border-border-default px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.2em] text-text-muted">
                      Primary
                    </span>
                  )}
                  {e.verified_at ? (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-brand">
                      <Check className="size-3" /> Verified
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-text-faint">
                      <Clock className="size-3" /> Pending
                    </span>
                  )}
                </div>
                {!e.is_primary && (
                  <button
                    onClick={() => handleRemove(e.id)}
                    className="text-text-muted transition-colors hover:text-destructive"
                    aria-label="Remove email"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(ev) => setNewEmail(ev.target.value)}
            placeholder="add another email"
            disabled={adding}
            className="h-10 flex-1 border border-border-default bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="flex h-10 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {adding ? "Sending…" : "Add"}
          </button>
        </form>
        <p className="text-[11px] text-text-muted">
          We&apos;ll send a one-click confirmation link to the new address.
        </p>
      </section>

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
