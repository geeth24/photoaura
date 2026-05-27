"use client"

import { useState } from "react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { UserPlus } from "lucide-react"
import { toast } from "sonner"

type Props = {
  albumSlug: string
  albumName: string
}

export function InviteClientDialog({ albumSlug, albumName }: Props) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [sending, setSending] = useState(false)

  const handleInvite = async () => {
    if (!fullName.trim() || !email.trim()) return
    setSending(true)
    try {
      const res = await apiFetch<{ message: string }>("/clients/invite", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          album_slug: albumSlug,
          user_name: userName.trim() || undefined,
        }),
      })
      toast.success(res.message || "Invite sent")
      setOpen(false)
      setFullName("")
      setEmail("")
      setUserName("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
            <UserPlus className="size-3.5" />
            Invite client
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a client</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a one-click link to view{" "}
            <span className="text-text-secondary">{albumName}</span>. No password needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              disabled={sending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              disabled={sending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-username">
              Username <span className="text-text-faint">(optional)</span>
            </Label>
            <Input
              id="client-username"
              value={userName}
              onChange={(e) =>
                setUserName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
              }
              placeholder="jane (defaults to email)"
              disabled={sending}
              maxLength={30}
            />
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-faint">
              Used at password sign-in. 3–30 chars · letters, numbers, _ or -
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={sending}>Cancel</Button>} />
          <Button onClick={handleInvite} disabled={sending || !fullName.trim() || !email.trim()}>
            {sending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
