"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search, Trash2, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { useDocumentTitle } from "@/lib/use-document-title"
import { apiFetch, bookingsApi } from "@/lib/api"
import { moneyShort, parseDay } from "@/lib/bookings"
import { daysFromToday, initialsOf, plural, relativeDay } from "@/lib/format"
import type { BookingSummary, User } from "@/lib/types"
import { FilterTabs, PageHeader } from "@/components/page-header"
import { CreateUserDialog } from "@/components/create-user-dialog"
import { ViewAsClientButton } from "@/components/view-as-client-button"
import { SendLinkButton } from "@/components/send-link-button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

type Filter = "all" | "clients" | "team" | "never" | "owes"
type Ledger = { owed: number; next: BookingSummary | null; count: number }

const LIVE = new Set(["sent", "signed", "booked", "event_complete", "delivered"])

// what each client owes and their next shoot, from the bookings list
function ledgerOf(rows: BookingSummary[]) {
  const map = new Map<number, Ledger>()
  for (const r of rows) {
    if (r.status === "cancelled") continue
    const l = map.get(r.client.user_id) ?? { owed: 0, next: null, count: 0 }
    l.count++
    if (LIVE.has(r.status)) l.owed += r.total_due_cents - r.paid_cents
    const day = parseDay(r.event_date)
    if (day && daysFromToday(day) >= 0 && LIVE.has(r.status) && (!l.next || r.event_date < l.next.event_date)) l.next = r
    map.set(r.client.user_id, l)
  }
  return map
}

const isTeam = (u: User) => u.role !== "client"

export default function UsersPage() {
  useDocumentTitle("Users")
  const [users, setUsers] = useState<User[] | null>(null)
  const [ledger, setLedger] = useState<Map<number, Ledger>>(new Map())
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const fetchUsers = useCallback(() => {
    apiFetch<User[]>("/users/").then(setUsers).catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    fetchUsers()
    bookingsApi
      .list()
      .then((rows) => setLedger(ledgerOf(rows)))
      .catch(() => {})
  }, [fetchUsers])

  const people = useMemo(
    () => (users ?? []).filter((u) => !u.parent_user_id).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users],
  )
  const match: Record<Filter, (u: User) => boolean> = {
    all: () => true,
    clients: (u) => !isTeam(u),
    team: isTeam,
    never: (u) => !isTeam(u) && !u.last_login_at,
    owes: (u) => (ledger.get(u.id)?.owed ?? 0) > 0,
  }
  const counts = Object.fromEntries(
    (Object.keys(match) as Filter[]).map((k) => [k, people.filter(match[k]).length]),
  ) as Record<Filter, number>
  const q = query.trim().toLowerCase()
  const shown = people.filter(
    (u) =>
      match[filter](u) &&
      (!q || [u.full_name, u.user_email, u.user_name, ...(u.family ?? []).map((f) => f.full_name)].some((v) => v?.toLowerCase().includes(q))),
  )
  const owedTotal = [...ledger.values()].reduce((n, l) => n + Math.max(l.owed, 0), 0)

  const remove = async (u: User) => {
    try {
      await apiFetch(`/users/${u.id}`, { method: "DELETE" })
      toast.success(`${u.full_name} deleted`)
      fetchUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete user")
    }
  }

  const subtitle = users
    ? [
        plural(counts.clients, "client"),
        plural(counts.team, "studio member"),
        counts.never ? `${counts.never} never signed in` : null,
        owedTotal ? `${moneyShort(owedTotal)} still owed` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Loading people…"

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="People" title="Users" subtitle={subtitle} actions={<CreateUserDialog onCreated={fetchUsers} />} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-border-default bg-surface-elevated px-3 sm:max-w-xs">
          <Search className="size-3.5 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none"
          />
        </label>
        <FilterTabs
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "Everyone", count: counts.all },
            { key: "clients", label: "Clients", count: counts.clients },
            { key: "team", label: "Studio", count: counts.team },
            { key: "never", label: "Never signed in", count: counts.never },
            { key: "owes", label: "Owes money", count: counts.owes },
          ]}
        />
      </div>

      {users == null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <UsersRound className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-lg text-text-primary">{people.length ? "Nobody matches" : "No users yet"}</p>
          <p className="mt-1 text-sm font-light text-text-muted">
            {people.length ? "Try another search or filter." : "Invite a client from one of your albums."}
          </p>
        </div>
      ) : (
        <div className="border border-border-subtle">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_96px_auto] gap-6 border-b border-border-subtle bg-surface-elevated px-5 py-3 text-[10px] font-medium uppercase tracking-[0.25em] text-text-faint lg:grid">
            <span>Person</span>
            <span>Galleries</span>
            <span>Bookings</span>
            <span>Last seen</span>
            <span className="w-[300px]" />
          </div>
          <ul className="divide-y divide-border-subtle">
            {shown.map((u) => (
              <PersonRow key={u.id} user={u} ledger={ledger.get(u.id)} onDelete={() => remove(u)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PersonRow({ user: u, ledger, onDelete }: { user: User; ledger?: Ledger; onDelete: () => void }) {
  const team = isTeam(u)
  const albums = u.albums ?? []
  const next = ledger?.next
  const seen = u.last_login_at ? relativeDay(u.last_login_at) : "Never"
  return (
    <li className="group grid gap-x-6 gap-y-2.5 px-4 py-4 sm:px-5 transition-colors hover:bg-surface-elevated/60 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_96px_auto] lg:items-center">
      <Link href={`/users/${u.id}`} className="flex min-w-0 items-center gap-3.5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center text-[11px] font-medium tracking-wider",
            team ? "border border-border-default text-text-secondary" : "bg-brand/10 text-brand",
          )}
        >
          {initialsOf(u.full_name) || "?"}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary group-hover:text-brand">{u.full_name}</span>
            {team && (
              <span className="shrink-0 border border-border-default px-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-text-muted">
                Studio
              </span>
            )}
          </span>
          <span className="block truncate text-[12px] font-light text-text-muted">{u.user_email}</span>
          {(u.family?.length ?? 0) > 0 && (
            <span className="block truncate text-[11px] text-text-faint">+ {u.family!.map((f) => f.full_name).join(", ")}</span>
          )}
        </span>
      </Link>

      <p className="truncate pl-[54px] text-[12px] font-light text-text-muted lg:hidden">
        {[
          team ? "Studio" : plural(albums.length, "gallery", "galleries"),
          ledger && ledger.owed > 0 ? `${moneyShort(ledger.owed)} owed` : null,
          `seen ${seen.toLowerCase()}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="hidden min-w-0 text-[12px] lg:block">
        {team ? (
          <span className="text-text-faint">Sees every album</span>
        ) : albums.length ? (
          <>
            <span className="text-text-secondary">{plural(albums.length, "gallery", "galleries")}</span>
            <span className="block truncate font-light text-text-faint">{albums.map((a) => a.album_name).join(", ")}</span>
          </>
        ) : (
          <span className="text-text-faint">No galleries yet</span>
        )}
      </div>

      <div className="hidden min-w-0 text-[12px] lg:block">
        {ledger && ledger.owed > 0 && <span className="block text-brand">{moneyShort(ledger.owed)} owed</span>}
        {next ? (
          <Link href={`/bookings/${next.number}`} className="block truncate font-light text-text-muted hover:text-text-primary">
            {next.event_type} · {parseDay(next.event_date)!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Link>
        ) : (
          !ledger?.owed && (
            <span className="text-text-faint">{ledger?.count ? plural(ledger.count, "booking") : "—"}</span>
          )
        )}
      </div>

      <span className={cn("hidden text-[12px] lg:block", u.last_login_at ? "text-text-muted" : "text-brand")}>{seen}</span>

      <div className="flex items-center gap-1.5 max-lg:pl-[54px] lg:w-[300px] lg:justify-end">
        {!team && <ViewAsClientButton userId={u.id} compact />}
        <SendLinkButton userId={u.id} />
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <button
                className="flex size-9 shrink-0 items-center justify-center text-text-faint transition-all hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                aria-label={`Delete ${u.full_name}`}
              />
            }
          >
            <Trash2 className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {u.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the account{(u.family?.length ?? 0) > 0 ? " and the family members on it" : ""}. It can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}

