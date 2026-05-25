"use client"

import { useState, useRef, useCallback } from "react"
import { uploadAlbum, type UploadStage } from "@/lib/api"
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
import { UploadCloud, ImageIcon } from "lucide-react"
import { toast } from "sonner"

type Props = {
  mode: "new" | "existing"
  userId: number
  albumName?: string
  onUploaded: () => void
  trigger: React.ReactNode
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

export function UploadAlbumDialog({ mode, userId, albumName, onUploaded, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [faceDetection, setFaceDetection] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState<UploadStage | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setName("")
    setFiles([])
    setFaceDetection(false)
    setStage(null)
    setUploading(false)
  }

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const imgs = Array.from(incoming).filter((f) => f.type.startsWith("image/"))
    setFiles((prev) => [...prev, ...imgs])
  }, [])

  const resolvedName = mode === "new" ? name.trim() : albumName ?? ""
  const canUpload = resolvedName.length > 0 && files.length > 0 && !uploading

  const handleUpload = async () => {
    if (!canUpload) return
    setUploading(true)
    setStage({ stage: "uploading", pct: 0 })
    try {
      await uploadAlbum(
        { files, albumName: resolvedName, userId, faceDetection },
        setStage
      )
      toast.success(
        mode === "new"
          ? `Created "${resolvedName}" with ${files.length} photo${files.length === 1 ? "" : "s"}`
          : `Uploaded ${files.length} photo${files.length === 1 ? "" : "s"}`
      )
      onUploaded()
      setOpen(false)
      reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
      setUploading(false)
      setStage(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (uploading) return
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
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

          {/* dropzone */}
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
            <p className="text-xs text-muted-foreground">PNG, JPG, HEIC</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
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
