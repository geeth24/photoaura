"use client"

import { useEffect, useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { Download, FileArchive, Inbox, X } from "lucide-react"
import { toast } from "sonner"

type ClientFile = {
  id: number
  user_id: number
  client_name: string | null
  client_email: string | null
  album_name: string | null
  filename: string
  size: number | null
  content_type: string | null
  created_at: string | null
  download_url?: string
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ""
  const mb = bytes / 1024 / 1024
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function fmtDate(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

function startDownload(url?: string) {
  if (!url) {
    toast.error("Download link expired — refresh the page.")
    return
  }
  const a = document.createElement("a")
  a.href = url
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function DownloadsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role !== "client"

  const [files, setFiles] = useState<ClientFile[]>([])
  const [loaded, setLoaded] = useState(false)

  const fetchFiles = useCallback(() => {
    const path = isAdmin ? "/client-files" : "/me/files"
    apiFetch<ClientFile[]>(path)
      .then((rows) => {
        setFiles(rows)
        setLoaded(true)
      })
      .catch(() => {
        setFiles([])
        setLoaded(true)
      })
  }, [isAdmin])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const remove = async (id: number) => {
    try {
      await apiFetch(`/client-files/${id}`, { method: "DELETE" })
      toast.success("Removed")
      fetchFiles()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove")
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div>
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Downloads
          </span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          {isAdmin ? "Client downloads" : "Your downloads"}
        </h1>
        <p className="mt-3 text-sm font-light text-text-secondary">
          {isAdmin
            ? "Every file you've shared with clients. Attach new ones from an album."
            : "Full-resolution files your photographer prepared for you."}
        </p>
      </div>

      {!loaded ? (
        <div className="border border-border-subtle px-5 py-6 text-sm font-light text-text-muted">
          Loading…
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-20 text-center">
          <Inbox className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">
            Nothing here yet
          </p>
          <p className="mt-1 text-sm font-light text-text-muted">
            {isAdmin
              ? "Open an album → Downloads to attach a file for a client."
              : "When your photographer shares a download, it'll appear here."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle border border-border-subtle">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-4 px-5 py-4">
              <FileArchive className="size-5 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{f.filename}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.15em] text-text-muted">
                  {(isAdmin
                    ? [f.client_name || f.client_email, f.album_name, fmtSize(f.size)]
                    : [f.album_name, fmtSize(f.size), fmtDate(f.created_at)]
                  )
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>
              <button
                onClick={() => startDownload(f.download_url)}
                className="flex h-9 shrink-0 items-center gap-2 bg-brand px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary"
              >
                <Download className="size-3.5" />
                Download
              </button>
              {isAdmin && (
                <button
                  onClick={() => remove(f.id)}
                  className="shrink-0 text-text-muted opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Remove"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
