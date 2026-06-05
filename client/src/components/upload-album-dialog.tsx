"use client"

import { useState, useRef, useCallback } from "react"
import { uploadAlbum, uploadAlbumZip, type UploadStage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
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
import { UploadCloud, ImageIcon, ScanFace, FileArchive } from "lucide-react"
import { toast } from "sonner"

type Props = {
  mode: "new" | "existing"
  userId: number
  albumName?: string
  onUploaded: () => void
  trigger?: React.ReactNode
  // controlled open (e.g. opened by a page-level drop)
  open?: boolean
  onOpenChange?: (open: boolean) => void
  // seed the dialog with files (from a drop) when it opens
  initialFiles?: File[]
  // album already has face detection -> always on, don't ask
  lockFaceDetection?: boolean
}

const STAGE_LABEL: Record<UploadStage["stage"], string> = {
  uploading: "Uploading photos",
  saving: "Saving",
  faces: "Detecting faces",
  warming: "Optimizing images",
  done: "Finishing up",
}

function stagePct(s: UploadStage): number {
  if (s.stage === "uploading") return s.pct ?? 0
  if (s.stage === "done") return 100
  if (s.total) return Math.round(((s.current ?? 0) / s.total) * 100)
  return 0
}

function stageDetail(s: UploadStage): string {
  if (s.stage === "uploading") return `${s.pct ?? 0}%`
  if (s.stage === "done") return ""
  if (s.total) return `${s.current ?? 0}/${s.total}`
  return ""
}

export function UploadAlbumDialog({
  mode,
  userId,
  albumName,
  onUploaded,
  trigger,
  open: controlledOpen,
  onOpenChange,
  initialFiles,
  lockFaceDetection = false,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const [name, setName] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [uploadMode, setUploadMode] = useState<"files" | "zip">("files")
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [faceDetection, setFaceDetection] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState<UploadStage | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setName("")
    setFiles([])
    setUploadMode("files")
    setZipFile(null)
    setFaceDetection(false)
    setStage(null)
    setUploading(false)
  }

  const setOpen = (o: boolean) => {
    if (uploading) return
    if (onOpenChange) onOpenChange(o)
    else setInternalOpen(o)
    if (!o) reset()
  }

  // seed dropped files when opened with them — render-time state adjustment
  // (the sanctioned React pattern), guarded so it runs once per new drop
  const [seededFor, setSeededFor] = useState<File[] | null>(null)
  if (open && initialFiles && initialFiles.length && seededFor !== initialFiles) {
    setSeededFor(initialFiles)
    setFiles(initialFiles)
  }

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const media = Array.from(incoming).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    )
    setFiles((prev) => [...prev, ...media])
  }, [])

  const resolvedName = mode === "new" ? name.trim() : albumName ?? ""
  const faces = lockFaceDetection || faceDetection
  const hasPayload = uploadMode === "files" ? files.length > 0 : zipFile !== null
  const canUpload = resolvedName.length > 0 && hasPayload && !uploading

  const handleUpload = async () => {
    if (!canUpload) return
    setUploading(true)
    setStage({ stage: "uploading", pct: 0 })
    try {
      if (uploadMode === "zip" && zipFile) {
        await uploadAlbumZip(
          { file: zipFile, albumName: resolvedName, userId, faceDetection: faces },
          setStage
        )
        toast.success(`Uploaded "${zipFile.name}" to ${resolvedName}`)
      } else {
        await uploadAlbum(
          { files, albumName: resolvedName, userId, faceDetection: faces },
          setStage
        )
        toast.success(
          mode === "new"
            ? `Created "${resolvedName}" with ${files.length} photo${files.length === 1 ? "" : "s"}`
            : `Uploaded ${files.length} photo${files.length === 1 ? "" : "s"}`
        )
      }
      onUploaded()
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
      setUploading(false)
      setStage(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "New album" : `Upload to ${albumName}`}</DialogTitle>
          <DialogDescription>
            {mode === "new"
              ? "Name the album and drop in your photos."
              : "Add more photos to this album."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "new" && (
            <div className="grid gap-1.5">
              <Label htmlFor="album-name">Album name</Label>
              <Input
                id="album-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer 2026"
                disabled={uploading}
              />
            </div>
          )}

          {/* files / zip mode toggle */}
          <div className="flex border border-border-default">
            {(["files", "zip"] as const).map((m, i) => {
              const active = uploadMode === m
              return (
                <button
                  key={m}
                  onClick={() => !uploading && setUploadMode(m)}
                  disabled={uploading}
                  className={`h-9 flex-1 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors ${
                    i > 0 ? "border-l border-border-default" : ""
                  } ${
                    active
                      ? "bg-surface-hover text-brand"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {m === "files" ? "Files" : "Zip"}
                </button>
              )
            })}
          </div>

          {uploadMode === "files" ? (
            <>
              {/* photo/video dropzone */}
              <div
                onClick={() => !uploading && inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!uploading) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (!uploading) addFiles(e.dataTransfer.files)
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors ${
                  dragging ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
                } ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <UploadCloud className="size-7 text-muted-foreground" />
                <div className="text-sm">
                  <span className="font-medium text-foreground">Click to choose</span>
                  <span className="text-muted-foreground"> or drag photos here</span>
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, HEIC, MP4, MOV</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>

              {files.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{files.length}</span>
                    <span className="text-muted-foreground">
                      photo{files.length === 1 ? "" : "s"} ready
                    </span>
                  </span>
                  {!uploading && (
                    <button
                      onClick={() => setFiles([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* zip dropzone */}
              <div
                onClick={() => !uploading && zipInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!uploading) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  const f = e.dataTransfer.files?.[0]
                  if (!uploading && f && /\.zip$/i.test(f.name)) setZipFile(f)
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors ${
                  dragging ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
                } ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <FileArchive className="size-7 text-muted-foreground" />
                <div className="text-sm">
                  <span className="font-medium text-foreground">Click to choose</span>
                  <span className="text-muted-foreground"> or drag a .zip here</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  A zip of original photos &amp; videos
                </p>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {zipFile && (
                <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileArchive className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{zipFile.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {(zipFile.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                  {!uploading && (
                    <button
                      onClick={() => setZipFile(null)}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {lockFaceDetection ? (
            <div className="flex items-center gap-2 rounded-lg border border-input p-3 text-sm text-muted-foreground">
              <ScanFace className="size-4" />
              Face detection is on for this album — new photos are indexed automatically.
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-input p-3">
              <div className="space-y-0.5">
                <Label htmlFor="face-detection" className="text-sm">Face detection</Label>
                <p className="text-xs text-muted-foreground">Detect and index faces on upload</p>
              </div>
              <Switch
                id="face-detection"
                checked={faceDetection}
                onCheckedChange={setFaceDetection}
                disabled={uploading}
              />
            </div>
          )}

          {uploading && stage && (
            <div className="space-y-1.5">
              <Progress value={stagePct(stage)} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{STAGE_LABEL[stage.stage]}…</span>
                <span>{stageDetail(stage)}</span>
              </div>
            </div>
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
          <Button onClick={handleUpload} disabled={!canUpload}>
            {uploading
              ? `${STAGE_LABEL[stage?.stage ?? "uploading"]}…`
              : mode === "new"
                ? "Create album"
                : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
