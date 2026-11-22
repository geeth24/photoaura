"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { brandButton, microLabel } from "@/components/page-header"

const EMPTY = { full_name: "", user_name: "", user_email: "", user_password: "" }
const FIELDS: { key: keyof typeof EMPTY; label: string; placeholder: string; type?: string }[] = [
  { key: "full_name", label: "Full name", placeholder: "Jamie Rivera" },
  { key: "user_name", label: "Username", placeholder: "jamie" },
  { key: "user_email", label: "Email", placeholder: "jamie@example.com", type: "email" },
  { key: "user_password", label: "Password", placeholder: "••••••••", type: "password" },
]

export function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const create = async () => {
    setCreating(true)
    try {
      await apiFetch("/create-user", { method: "POST", body: JSON.stringify(form) })
      toast.success("User created")
      setOpen(false)
      setForm(EMPTY)
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className={brandButton} />}>
        <Plus className="size-3.5" />
        Add user
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-normal tracking-tight">Create user</DialogTitle>
          <DialogDescription>
            To share a gallery with a client, invite them from the album instead; they get a sign-in link by email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="grid gap-2">
              <span className={microLabel}>{f.label}</span>
              <Input
                type={f.type}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="h-11 bg-surface-elevated"
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <button onClick={create} disabled={creating} className={brandButton}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
