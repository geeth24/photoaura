"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, File, FileArchive, FileText, Film, Inbox, Paperclip, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useDocumentTitle } from "@/lib/use-document-title"
import { apiFetch } from "@/lib/api"
import type { Album } from "@/lib/types"
import { fmtBytes, initialsOf, plural, relativeDay } from "@/lib/format"
import { FilterTabs, microLabel, PageHeader, quietButton } from "@/components/page-header"
import { ManageDownloadsDialog } from "@/components/manage-downloads-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlbumOptions } from "@/components/album-options"
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

type ClientFile = {
  id: number
  user_id: number
  client_name: string | null
  client_email: string | null
  album_id: number | null
  album_name: string | null
  filename: string
  size: number | null
  content_type: string | null
  created_at: string | null
  download_url?: string | null
}

type Kind = "all" | "film" | "archive" | "document"

function kindOf(f: ClientFile): Exclude<Kind, "all"> | "other" {
  const t = (f.content_type ?? "").toLowerCase()
  const name = f.filename.toLowerCase()
  if (t.startsWith("video/")) return "film"
  if (t.includes("zip") || t.includes("compressed") || /\.(zip|rar|7z)$/.test(name)) return "archive"
  if (t.includes("pdf") || t.startsWith("text/") || t.includes("document") || /\.(pdf|docx?)$/.test(name)) return "document"
  return "other"
}

const ICONS = { film: Film, archive: FileArchive, document: FileText, other: File }

function startDownload(url?: string | null) {
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

type Group = { userId: number; name: string; email: string | null; files: ClientFile[]; bytes: number; albums: [number, string][] }

function groupByClient(files: ClientFile[]): Group[] {
  const map = new Map<number, Group>()
  for (const f of files) {
    let g = map.get(f.user_id)
    if (!g) {
      g = { userId: f.user_id, name: f.client_name || f.client_email || "Unknown client", email: f.client_email, files: [], bytes: 0, albums: [] }
      map.set(f.user_id, g)
    }
    g.files.push(f)
    g.bytes += f.size ?? 0
    if (f.album_id && !g.albums.some(([id]) => id === f.album_id)) g.albums.push([f.album_id, f.album_name ?? "Album"])
  }
  // most recent delivery first
  return [...map.values()].sort((a, b) => (b.files[0]?.created_at ?? "").localeCompare(a.files[0]?.created_at ?? ""))
}

export default function DownloadsPage() {
  useDocumentTitle("Downloads")
  const [files, setFiles] = useState<ClientFile[] | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<Kind>("all")
  const [attachTo, setAttachTo] = useState<Album | null>(null)

  const fetchFiles = useCallback(() => {
    apiFetch<ClientFile[]>("/client-files")
      .then((rows) => setFiles([...rows].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))))
      .catch(() => setFiles([]))
  }, [])

  useEffect(() => {
    fetchFiles()
    apiFetch<Album[]>("/albums/").then(setAlbums).catch(() => setAlbums([]))
  }, [fetchFiles])

  const remove = async (f: ClientFile) => {
    try {
      await apiFetch(`/client-files/${f.id}`, { method: "DELETE" })
      toast.success(`Removed ${f.filename}`)
      fetchFiles()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove")
    }
  }

  const slugOf = useMemo(() => new Map(albums.map((a) => [a.album_id, a.slug])), [albums])
  const counts = useMemo(() => {
    const c = { film: 0, archive: 0, document: 0 }
    for (const f of files ?? []) {
      const k = kindOf(f)
      if (k !== "other") c[k]++
    }
    return c
  }, [files])
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = (files ?? []).filter(
      (f) =>
        (kind === "all" || kindOf(f) === kind) &&
        (!q || [f.filename, f.client_name, f.client_email, f.album_name].some((v) => v?.toLowerCase().includes(q))),
    )
    return groupByClient(shown)
  }, [files, query, kind])

  const totalBytes = (files ?? []).reduce((n, f) => n + (f.size ?? 0), 0)
  const clientCount = new Set((files ?? []).map((f) => f.user_id)).size

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Delivery"
        title="Downloads"
        subtitle="Films, print sets and documents handed to clients alongside their galleries."
        actions={
          <Select
            value=""
            onValueChange={(v) => setAttachTo(albums.find((a) => String(a.album_id) === String(v)) ?? null)}
          >
            <SelectTrigger className={`${quietButton} h-10 w-auto gap-2 bg-transparent`}>
              <Paperclip className="size-3.5" />
              <SelectValue>{() => "Attach a file"}</SelectValue>
            </SelectTrigger>
            <AlbumOptions albums={albums} align="end" alignItemWithTrigger={false} />
          </Select>
        }
      />

      <dl className="grid grid-cols-2 gap-px border border-border-subtle bg-border-subtle lg:grid-cols-4">
        {[
          ["Files", files ? files.length.toLocaleString() : "—"],
          ["Total size", files ? fmtBytes(totalBytes) : "—"],
          ["Films", files ? counts.film.toLocaleString() : "—"],
          ["Clients", files ? clientCount.toLocaleString() : "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface-elevated px-5 py-5">
            <dt className={microLabel}>{label}</dt>
            <dd className="mt-3 font-heading text-3xl leading-none tracking-tight text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-border-default bg-surface-elevated px-3 sm:max-w-xs">
          <Search className="size-3.5 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client, album or file"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none"
          />
        </label>
        <FilterTabs
          value={kind}
          onChange={setKind}
          options={[
            { key: "all", label: "All" },
            { key: "film", label: "Films", count: counts.film },
            { key: "archive", label: "Archives", count: counts.archive },
            { key: "document", label: "Documents", count: counts.document },
          ]}
        />
      </div>

      {files == null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border-default py-20 text-center">
          <Inbox className="size-7 text-text-faint" />
          <p className="mt-4 font-heading text-xl text-text-primary">{files.length ? "No files match" : "Nothing delivered yet"}</p>
          <p className="mt-1 text-sm font-light text-text-muted">
            {files.length ? "Try another search or type." : "Use Attach a file to hand a film or print set to a client."}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.userId} className="space-y-3">
              <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <Link href={`/users/${g.userId}`} className="group flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-brand/10 text-[11px] font-medium tracking-wider text-brand">
                    {initialsOf(g.name) || "?"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-xl leading-tight text-text-primary group-hover:text-brand">{g.name}</span>
                    <span className="block truncate text-[11px] uppercase tracking-[0.15em] text-text-faint">
                      {plural(g.files.length, "file")} · {fmtBytes(g.bytes)}
                    </span>
                  </span>
                </Link>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {g.albums.map(([id, name]) =>
                    slugOf.get(id) ? (
                      <Link key={id} href={`/albums/${slugOf.get(id)}`} className="text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-brand">
                        {name} ↗
                      </Link>
                    ) : null,
                  )}
                </div>
              </header>
              <ul className="divide-y divide-border-subtle border border-border-subtle bg-surface-elevated">
                {g.files.map((f) => (
                  <FileRow key={f.id} file={f} onRemove={() => remove(f)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {attachTo?.album_id != null && (
        <ManageDownloadsDialog
          key={attachTo.slug}
          albumId={attachTo.album_id}
          albumSlug={attachTo.slug}
          albumName={attachTo.album_name}
          open
          onOpenChange={(o) => {
            if (!o) {
              setAttachTo(null)
              fetchFiles()
            }
          }}
        />
      )}
    </div>
  )
}

function FileRow({ file: f, onRemove }: { file: ClientFile; onRemove: () => void }) {
  const kind = kindOf(f)
  const Icon = ICONS[kind]
  return (
    <li className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-3.5 sm:grid-cols-[auto_1fr_96px_84px_auto] sm:px-5">
      <span className="flex size-9 items-center justify-center border border-border-subtle bg-surface text-text-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-text-primary">{f.filename}</p>
        <p className="truncate text-[11px] font-light text-text-muted">
          {f.album_name ?? "No album"}
          <span className="sm:hidden">
            {" · "}
            {fmtBytes(f.size)} · {relativeDay(f.created_at)}
          </span>
        </p>
      </div>
      <span className="hidden text-right text-[11px] text-text-muted sm:block">{relativeDay(f.created_at)}</span>
      <span className="hidden text-right text-[11px] tabular-nums text-text-muted sm:block">{fmtBytes(f.size)}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => startDownload(f.download_url)}
          aria-label={`Download ${f.filename}`}
          className="flex size-9 items-center justify-center text-text-muted transition-colors hover:text-brand"
        >
          <Download className="size-4" />
        </button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <button
                aria-label={`Remove ${f.filename}`}
                className="flex size-9 items-center justify-center text-text-faint transition-colors hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              />
            }
          >
            <Trash2 className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this file?</AlertDialogTitle>
              <AlertDialogDescription>
                {f.client_name ?? "The client"} will no longer see {f.filename}. The file is deleted for good.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onRemove}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}
