"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Users, X } from "lucide-react"
import { toast } from "sonner"

type Person = {
  id?: number
  user_id?: number
  user_name?: string | null
  full_name?: string | null
  user_email?: string | null
  role?: string | null
}

type Props = {
  albumSlug: string
  albumName: string
}

// helper to read either shape (some endpoints return id, perms endpoint returns user_id)
const personId = (p: Person) => p.user_id ?? p.id ?? 0
const personLabel = (p: Person) =>
  p.full_name?.trim() || p.user_name || p.user_email || `User ${personId(p)}`

export function AlbumAccessDialog({ albumSlug, albumName }: Props) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<Person[]>([])
  const [allClients, setAllClients] = useState<Person[]>([])
  const [busy, setBusy] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [perms, clients] = await Promise.all([
        apiFetch<Person[]>(`/album/${albumSlug}/permissions`),
        apiFetch<Person[]>("/users/"),
      ])
      setMembers(perms)
      setAllClients(clients.filter((c) => (c.role || "").toLowerCase() === "client"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load access list")
    }
  }, [albumSlug])

  useEffect(() => {
    if (open) fetchAll()
  }, [open, fetchAll])

  const memberIDs = new Set(members.map(personId))
  const available = allClients.filter((c) => !memberIDs.has(personId(c)))

  const grant = async (userId: number) => {
    setBusy(userId)
    try {
      await apiFetch(`/album/${albumSlug}/permissions`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      })
      toast.success("Access granted")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't grant access")
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (userId: number) => {
    setBusy(userId)
    try {
      await apiFetch(`/album/${albumSlug}/permissions/${userId}`, {
        method: "DELETE",
      })
      toast.success("Access revoked")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't revoke")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
            <Users className="size-3.5" />
            Manage access
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Who can view{" "}
            <span className="text-text-secondary">{albumName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
              People with access ({members.length})
            </p>
            <div className="divide-y divide-border-subtle border border-border-subtle">
              {members.length === 0 ? (
                <p className="px-3 py-3 text-sm font-light text-text-muted">
                  No one yet.
                </p>
              ) : (
                members.map((m) => (
                  <div
                    key={personId(m)}
                    className="group flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">
                        {personLabel(m)}
                      </p>
                      {m.user_email && (
                        <p className="truncate text-[11px] text-text-muted">
                          {m.user_email}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => revoke(personId(m))}
                      disabled={busy === personId(m)}
                      className="text-text-muted opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
                      aria-label="Revoke access"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
              Add existing client
            </p>
            <div className="divide-y divide-border-subtle border border-border-subtle max-h-60 overflow-y-auto">
              {available.length === 0 ? (
                <p className="px-3 py-3 text-sm font-light text-text-muted">
                  Everyone with a client account already has access.
                </p>
              ) : (
                available.map((c) => (
                  <button
                    key={personId(c)}
                    onClick={() => grant(personId(c))}
                    disabled={busy === personId(c)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:pointer-events-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">
                        {personLabel(c)}
                      </p>
                      {c.user_email && (
                        <p className="truncate text-[11px] text-text-muted">
                          {c.user_email}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-brand">
                      Add
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Done</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
