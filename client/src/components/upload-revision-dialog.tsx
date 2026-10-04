"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { previewRevision, uploadRevision } from "@/lib/api"
import type { RevisionPreview } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { UploadDropzone, UploadProgress } from "@/components/upload-dropzone"
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
import { ArrowRight, Layers, Loader2 } from "lucide-react"
import { toast } from "sonner"

const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"

export function UploadRevisionDialog({
  albumSlug,
  albumName,
  onUploaded,
}: {
  albumSlug: string
  albumName: string
  onUploaded: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<RevisionPreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState("")
  const [notify, setNotify] = useState(true)
  const [addUnmatched, setAddUnmatched] = useState(false)
  const [pct, setPct] = useState<number | null>(null)
  const uploading = pct !== null
  const previewRun = useRef(0)

  const reset = () => {
    setFiles([])
    setPreview(null)
    setNote("")
    setNotify(true)
    setAddUnmatched(false)
    setPct(null)
  }

  const changeOpen = (o: boolean) => {
    if (uploading) return
    setOpen(o)
    if (!o) reset()
  }

  // the server matches by filename, so dry-run every pick before sending bytes
  const addFiles = (incoming: File[]) => {
    const have = new Set(files.map((f) => f.name))
    const fresh = incoming.filter((f) => !have.has(f.name))
    if (!fresh.length) return
    const next = [...files, ...fresh]
    setFiles(next)
    const run = ++previewRun.current
    setChecking(true)
    previewRevision(
      albumSlug,
      next.map((f) => f.name),
    )
      .then((p) => run === previewRun.current && setPreview(p))
      .catch((e) => {
        if (run !== previewRun.current) return
        setPreview(null)
        toast.error(e instanceof Error ? e.message : "Couldn't check those files")
      })
      .finally(() => run === previewRun.current && setChecking(false))
  }

  const clear = () => {
    previewRun.current++
    setFiles([])
    setPreview(null)
    setChecking(false)
  }

  const toSend = useMemo(() => {
    if (!preview) return []
    const names = new Set(preview.matched.map((m) => m.filename))
    if (addUnmatched) preview.unmatched.forEach((n) => names.add(n))
    return files.filter((f) => names.has(f.name))
  }, [files, preview, addUnmatched])

  const matched = preview?.matched ?? []
  const unmatched = preview?.unmatched ?? []
  const duplicates = preview?.duplicates ?? []
  const number = preview?.next_number
  const canSend = !!preview && toSend.length > 0 && !checking && !uploading

  const send = async () => {
    if (!canSend || !number) return
    setPct(0)
    try {
      const res = await uploadRevision(
        albumSlug,
        { files: toSend, note, notify, addUnmatched },
        setPct,
      )
      const n = res.updated.length + res.added.length
      toast.success(
        `Revision ${res.revision.number} uploaded · ${n} ${n === 1 ? "photo" : "photos"}`,
      )
      onUploaded()
      setOpen(false)
      reset()
      // faces and cdn warming run in the background, same as a normal upload
      if (res.processing) router.push(`/albums/${albumSlug}/processing`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
      setPct(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <button className="flex h-10 items-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
            <Layers className="size-3.5" />
            Upload revision
          </button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {number ? `Revision ${number} of ${albumName}` : `Upload a revision`}
          </DialogTitle>
          <DialogDescription>
            Drop the re-edited photos. Each one replaces the photo with the same
            filename; the earlier version is kept and clients see the new one.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70dvh] space-y-5 overflow-y-auto pr-1">
          <UploadDropzone
            onFiles={addFiles}
            disabled={uploading}
            accept="image/*"
            hint="Same filenames as the gallery. IMG_1234_v2.jpg works too."
            compact={files.length > 0}
          />

          {files.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className={micro}>
                  {checking ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-3 animate-spin" /> Matching {files.length} files…
                    </span>
                  ) : (
                    `${matched.length} of ${files.length} match a photo`
                  )}
                </span>
                {!uploading && (
                  <button
                    onClick={clear}
                    className="text-xs text-text-muted transition-colors hover:text-text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>

              {matched.length > 0 && (
                <div className="max-h-52 divide-y divide-border-subtle overflow-y-auto border border-border-subtle">
                  {matched.map((m) => (
                    <div
                      key={m.filename}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-text-primary" title={m.filename}>
                        {m.filename}
                      </span>
                      <ArrowRight className="size-3.5 text-text-faint" />
                      <span className="truncate text-text-secondary" title={m.current_filename}>
                        {m.current_filename}
                      </span>
                      <span className="text-[11px] font-medium tracking-[0.08em] text-brand tabular-nums">
                        v{m.current_version} → v{m.next_version}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {unmatched.length > 0 && (
                <div className="space-y-2">
                  <p className={micro}>Not in this gallery ({unmatched.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {unmatched.map((n) => (
                      <span
                        key={n}
                        className="border border-border-default px-2 py-0.5 text-xs text-text-secondary"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                  <label className="flex items-center gap-2.5 pt-1 text-sm text-text-secondary">
                    <Checkbox
                      checked={addUnmatched}
                      onCheckedChange={(v) => setAddUnmatched(!!v)}
                      disabled={uploading}
                    />
                    Add them as new photos
                  </label>
                </div>
              )}

              {duplicates.length > 0 && (
                <div className="space-y-2">
                  <p className={micro}>Skipped, same photo twice ({duplicates.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {duplicates.map((n) => (
                      <span
                        key={n}
                        className="border border-dashed border-border-default px-2 py-0.5 text-xs text-text-muted"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="revision-note">Note for your client</Label>
            <Textarea
              id="revision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Skin retouching on 14 photos"
              disabled={uploading}
              className="text-sm md:text-sm"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-input p-3">
            <div className="space-y-0.5">
              <Label htmlFor="revision-notify" className="text-sm">
                Email clients when it&apos;s ready
              </Label>
              <p className="text-xs text-muted-foreground">
                Sent once processing finishes, with a link straight to the new photos
              </p>
            </div>
            <Switch
              id="revision-notify"
              checked={notify}
              onCheckedChange={setNotify}
              disabled={uploading}
            />
          </div>

          {uploading && (
            <UploadProgress
              value={pct ?? 0}
              label={pct === 100 ? "Saving" : "Uploading"}
              detail={`${pct}%`}
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={uploading}>
                Cancel
              </Button>
            }
          />
          <Button onClick={send} disabled={!canSend}>
            {uploading
              ? pct === 100
                ? "Saving…"
                : "Uploading…"
              : number && toSend.length
                ? `Push revision ${number} (${toSend.length} ${toSend.length === 1 ? "photo" : "photos"})`
                : "Push revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
