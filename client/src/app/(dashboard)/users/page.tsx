"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { apiFetch } from "@/lib/api"
import type { User } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Plus, Trash2, UsersRound } from "lucide-react"
import { toast } from "sonner"

const brandButton =
  "flex h-11 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"

const fieldLabel = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    user_name: "",
    user_password: "",
    full_name: "",
    user_email: "",
  })

  const fetchUsers = () => {
    setLoading(true)
    apiFetch<User[]>("/users/")
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await apiFetch("/create-user", {
        method: "POST",
        body: JSON.stringify(form),
      })
      toast.success("User created")
      setCreateOpen(false)
      setForm({ user_name: "", user_password: "", full_name: "", user_email: "" })
      fetchUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" })
      toast.success("User deleted")
      fetchUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete user")
    }
  }

  return (
    <div className="space-y-12">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <div className="mb-4 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Team
            </span>
          </div>
          <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
            Users
          </h1>
          <p className="mt-3 text-sm font-light text-text-secondary">
            {loading
              ? "Loading members…"
              : `${users.length} ${users.length === 1 ? "member" : "members"} with studio access`}
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<button className={brandButton} />}>
            <Plus className="size-3.5" />
            Add User
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl font-normal tracking-tight">
                Create user
              </DialogTitle>
              <DialogDescription>Add a new member to the studio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <label className={fieldLabel}>Full Name</label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="John Doe"
                  className="h-11 bg-surface-elevated"
                />
              </div>
              <div className="grid gap-2">
                <label className={fieldLabel}>Username</label>
                <Input
                  value={form.user_name}
                  onChange={(e) => setForm({ ...form, user_name: e.target.value })}
                  placeholder="johndoe"
                  className="h-11 bg-surface-elevated"
                />
              </div>
              <div className="grid gap-2">
                <label className={fieldLabel}>Email</label>
                <Input
                  type="email"
                  value={form.user_email}
                  onChange={(e) => setForm({ ...form, user_email: e.target.value })}
                  placeholder="john@example.com"
                  className="h-11 bg-surface-elevated"
                />
              </div>
              <div className="grid gap-2">
                <label className={fieldLabel}>Password</label>
                <Input
                  type="password"
                  value={form.user_password}
                  onChange={(e) => setForm({ ...form, user_password: e.target.value })}
                  placeholder="••••••••"
                  className="h-11 bg-surface-elevated"
                />
              </div>
            </div>
            <DialogFooter>
              <button onClick={handleCreate} disabled={creating} className={brandButton}>
                {creating ? "Creating…" : "Create User"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* user list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-16 text-center">
          <UsersRound className="size-6 text-text-faint" />
          <p className="mt-3 font-heading text-lg text-text-primary">No users yet</p>
          <p className="mt-1 text-sm font-light text-text-muted">
            Add a member to give them studio access.
          </p>
        </div>
      ) : (
        <div className="border-y border-border-subtle">
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: Math.min(i * 0.04, 0.3),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group flex items-center gap-4 border-b border-border-subtle py-4 last:border-b-0"
            >
              <div className="flex size-11 shrink-0 items-center justify-center bg-brand/10 text-[12px] font-medium uppercase tracking-wider text-brand">
                {initialsOf(u.full_name) || "?"}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {u.full_name}
                </p>
                <p className="truncate text-[12px] text-text-muted">{u.user_email}</p>
              </div>

              <div className="hidden flex-col items-end pr-2 sm:flex">
                <span className="font-heading text-xl leading-none text-text-primary">
                  {u.albums?.length ?? 0}
                </span>
                <span className="mt-1 text-[9px] uppercase tracking-[0.25em] text-text-faint">
                  Albums
                </span>
              </div>

              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <button
                      className="flex size-9 shrink-0 items-center justify-center text-text-faint opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                      aria-label={`Delete ${u.full_name}`}
                    />
                  }
                >
                  <Trash2 className="size-4" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete user?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes {u.full_name}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => handleDelete(u.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
