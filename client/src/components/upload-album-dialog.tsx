"use client"

import { useState, useRef, useCallback } from "react"
import { uploadAlbum } from "@/lib/api"
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
import { UploadCloud, X, ImageIcon } from "lucide-react"
import { toast } from "sonner"

type Props = {
  mode: "new" | "existing"
  userId: number
  albumName?: string
  onUploaded: () => void
  trigger: React.ReactNode
}

export function UploadAlbumDialog({ mode, userId, albumName, onUploaded, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [faceDetection, setFaceDetection] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setName("")
    setFiles([])
    setFaceDetection(false)
    setProgress(0)
    setUploading(false)
  }

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const imgs = Array.from(incoming).filter((f) => f.type.startsWith("image/"))
    setFiles((prev) => [...prev, ...imgs])
  }, [])

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i))

  const resolvedName = mode === "new" ? name.trim() : albumName ?? ""
  const canUpload = resolvedName.length > 0 && files.length > 0 && !uploading

  const handleUpload = async () => {
    if (!canUpload) return
    setUploading(true)
    setProgress(0)
    try {
      await uploadAlbum(
        { files, albumName: resolvedName, userId, faceDetection },
        setProgress
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="size-3.5" />
                  {files.length} photo{files.length === 1 ? "" : "s"} selected
                </span>
                {!uploading && (
                  <button
                    onClick={() => setFiles([])}
                    className="hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="group relative size-14 overflow-hidden rounded-md bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="size-full object-cover"
                    />
                    {!uploading && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(i)
                        }}
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
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

          {uploading && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-center text-xs text-muted-foreground">
                Uploading… {progress}%
              </p>
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
            {uploading ? "Uploading…" : mode === "new" ? "Create album" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
