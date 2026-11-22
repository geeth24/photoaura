"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Clock, EyeOff, LogOut, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import { initialsOf } from "@/lib/format"
import { brandButton, microLabel, PageHeader, quietButton, SectionLabel } from "@/components/page-header"
import { StoreBadges } from "@/components/store-badges"
import { Skeleton } from "@/components/ui/skeleton"

type Email = {
  id: number
  email: string
  verified_at: string | null
  is_primary: boolean
}

export default function ProfilePage() {
  useDocumentTitle("Profile")
  const { user, logout, isPreview, exitPreview } = useAuth()
  const [emails, setEmails] = useState<Email[] | null>(null)
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const isClient = user?.role === "client"

  const fetchEmails = useCallback(() => {
    apiFetch<Email[]>("/me/emails").then(setEmails).catch(() => setEmails([]))
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim() || adding || isPreview) return
    setAdding(true)
    try {
      await apiFetch("/me/emails", { method: "POST", body: JSON.stringify({ email: newEmail.trim() }) })
      toast.success("Verification email sent — check that inbox.")
      setNewEmail("")
      fetchEmails()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add email")
    } finally {
      setAdding(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await apiFetch(`/me/emails/${id}`, { method: "DELETE" })
      toast.success("Email removed")
      fetchEmails()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove")
    }
  }

  const primary = emails?.find((e) => e.is_primary)?.email ?? user?.user_email

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <PageHeader eyebrow="Account" title="Profile" subtitle={isPreview ? "You're previewing a client's account. Changes are off." : undefined} />

      <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
        <aside className="h-fit border border-border-subtle bg-surface-elevated lg:sticky lg:top-24">
          <div className="grain flex aspect-[4/3] items-center justify-center border-b border-border-subtle bg-surface">
            <span className="font-heading text-7xl leading-none tracking-tight text-brand">{initialsOf(user?.full_name) || "?"}</span>
          </div>
          <div className="space-y-5 p-6">
            <div>
              <h2 className="font-heading text-2xl leading-tight tracking-tight text-text-primary">{user?.full_name || "—"}</h2>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.25em] text-brand">
                {isClient ? "Client" : "Studio admin"}
              </p>
            </div>
            <dl className="space-y-3 border-t border-border-subtle pt-5 text-sm">
              <div>
                <dt className={microLabel}>Username</dt>
                <dd className="mt-1 truncate text-text-secondary">{user?.user_name ? `@${user.user_name}` : "—"}</dd>
              </div>
              <div>
                <dt className={microLabel}>Primary email</dt>
                <dd className="mt-1 truncate text-text-secondary">{primary || "—"}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="min-w-0 space-y-12">
          <section className="space-y-4">
            <SectionLabel aside={emails && <span className="text-[10px] uppercase tracking-[0.3em] text-text-faint">{emails.length}</span>}>
              Sign-in emails
            </SectionLabel>
            <p className="text-sm font-light text-text-muted">
              A sign-in link can go to any verified address{isClient ? ", so use the one you check most" : ""}.
            </p>
            <ul className="divide-y divide-border-subtle border border-border-subtle">
              {emails == null ? (
                <li className="p-4">
                  <Skeleton className="h-6 w-2/3" />
                </li>
              ) : emails.length === 0 ? (
                <li className="px-5 py-6 text-sm font-light text-text-muted">No emails linked yet. Add one below.</li>
              ) : (
                emails.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">{e.email}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.2em]">
                        {e.is_primary && <span className="text-text-muted">Primary</span>}
                        {e.verified_at ? (
                          <span className="flex items-center gap-1 text-success">
                            <Check className="size-3" /> Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-warning">
                            <Clock className="size-3" /> Waiting for confirmation
                          </span>
                        )}
                      </p>
                    </div>
                    {!e.is_primary && !isPreview && (
                      <button
                        onClick={() => remove(e.id)}
                        className="flex size-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-destructive"
                        aria-label={`Remove ${e.email}`}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
            <form onSubmit={add} className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(ev) => setNewEmail(ev.target.value)}
                placeholder="Add another email"
                disabled={adding || isPreview}
                className="h-10 min-w-0 flex-1 border border-border-default bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-faint focus:border-border-strong focus:outline-none disabled:opacity-60"
              />
              <button type="submit" disabled={adding || isPreview || !newEmail.trim()} className={brandButton}>
                <Plus className="size-3.5" />
                {adding ? "Sending…" : "Add"}
              </button>
            </form>
            <p className="text-[11px] text-text-faint">We send a one-click confirmation link to the new address.</p>
          </section>

          <section className="space-y-4">
            <SectionLabel>On your phone</SectionLabel>
            <p className="text-sm font-light text-text-muted">
              {isClient
                ? "Your galleries in the PhotoAura app, with saving straight to your photo library."
                : "The PhotoAura app signs in with the same account."}
            </p>
            <StoreBadges />
          </section>

          <section className="space-y-4">
            <SectionLabel>Session</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {isPreview && (
                <button onClick={exitPreview} className={`${quietButton} border-brand/50 text-brand hover:border-brand`}>
                  <EyeOff className="size-3.5" />
                  Exit preview
                </button>
              )}
              <button onClick={logout} className={`${quietButton} hover:border-destructive/50 hover:text-destructive`}>
                <LogOut className="size-3.5" />
                {isPreview ? "Sign out of both" : "Sign out"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
