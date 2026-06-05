"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, FileArchive, UploadCloud, X } from "lucide-react"
import { toast } from "sonner"

type Person = {
  user_id?: number
  id?: number
  full_name?: string | null
  user_email?: string | null
}

type ClientFile = {
  id: number
  user_id: number
  filename: string
  size: number | null
  created_at: string | null
}

type Props = {
  albumId: number
  albumSlug: string
  albumName: string
}

const personId = (p: Person) => p.user_id ?? p.id ?? 0
const personLabel = (p: Person) =>
  p.full_name?.trim() || p.user_email || `User ${personId(p)}`

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  const m = document.cookie.match(/(?:^|; )token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : null
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ""
  const mb = bytes / 1024 / 1024
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(1)} MB`
}

export function ManageDownloadsDialog({ albumId, albumSlug, albumName }: Props) {
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [filesByUser, setFilesByUser] = useState<ClientFile[]>([])
  const [selectedUser, setSelectedUser] = useState<number | "">("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [users, files] = await Promise.all([
        apiFetch<Person[]>("/users/"),
        apiFetch<ClientFile[]>(`/client-files?album_id=${albumId}`),
      ])
      // any client can receive a deliverable, not just album-permission holders
      const clients = users.filter(
        (u) => ((u as { role?: string }).role || "").toLowerCase() === "client"
      )
      setPeople(clients)
      setFilesByUser(files)
      if (clients.length === 1) setSelectedUser(personId(clients[0]))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load")
    }
  }, [albumId])

  useEffect(() => {
    if (open) fetchAll()
  }, [open, fetchAll])

  const upload = async () => {
    if (!file || selectedUser === "" || uploading) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("user_id", String(selectedUser))
      form.append("album_id", String(albumId))
      const res = await fetch(`${API_URL}/client-files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || "Upload failed")
      }
      toast.success("File attached")
      setFile(null)
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await apiFetch(`/client-files/${id}`, { method: "DELETE" })
      toast.success("Removed")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove")
    }
  }

  const nameForUser = (uid: number) => {
    const p = people.find((x) => personId(x) === uid)
    return p ? personLabel(p) : `User ${uid}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
            <Download className="size-3.5" />
            Downloads
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage downloads</DialogTitle>
          <DialogDescription>
            Attach a file (e.g. a zip of originals) for a client to download
            from <span className="text-text-secondary">{albumName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* attach form */}
          <div className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
              Attach a file
            </p>

            <Select
              value={selectedUser === "" ? "" : String(selectedUser)}
              onValueChange={(v) => setSelectedUser(v ? Number(v) : "")}
              disabled={uploading || people.length === 0}
            >
              <SelectTrigger className="h-10 w-full bg-surface-elevated">
                <SelectValue
                  placeholder={
                    people.length ? "Choose a client…" : "No clients on this album"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={personId(p)} value={String(personId(p))}>
                    {personLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div
              onClick={() => !uploading && inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-input p-6 text-center transition-colors hover:bg-muted/50 ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <UploadCloud className="size-6 text-muted-foreground" />
              {file ? (
                <span className="flex items-center gap-2 text-sm">
                  <FileArchive className="size-4 text-muted-foreground" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground">
                    {fmtSize(file.size)}
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Click to choose a file (zip, pdf, anything)
                </span>
              )}
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button
              onClick={upload}
              disabled={!file || selectedUser === "" || uploading}
              className="w-full"
            >
              {uploading ? "Uploading…" : "Attach file"}
            </Button>
          </div>

          {/* existing files */}
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
              Attached ({filesByUser.length})
            </p>
            <div className="divide-y divide-border-subtle border border-border-subtle">
              {filesByUser.length === 0 ? (
                <p className="px-3 py-3 text-sm font-light text-text-muted">
                  Nothing attached to this album yet.
                </p>
              ) : (
                filesByUser.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">
                        {f.filename}
                      </p>
                      <p className="truncate text-[11px] text-text-muted">
                        {nameForUser(f.user_id)} · {fmtSize(f.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(f.id)}
                      className="text-text-muted opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
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
