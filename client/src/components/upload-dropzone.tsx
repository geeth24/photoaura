"use client"

import { useRef, useState } from "react"
import { UploadCloud } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export function mediaOnly(list: FileList | File[] | null): File[] {
  if (!list) return []
  return Array.from(list).filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
  )
}

export function UploadDropzone({
  onFiles,
  disabled = false,
  accept = "image/*,video/*",
  hint = "PNG, JPG, HEIC, MP4, MOV",
  compact = false,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  accept?: string
  hint?: string
  // a slim strip once files are picked, so what's below stays in view
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) onFiles(mediaOnly(e.dataTransfer.files))
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center ${compact ? "p-3" : "p-8"} transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      {!compact && <UploadCloud className="size-7 text-muted-foreground" />}
      <div className="text-sm">
        <span className="font-medium text-foreground">Click to choose</span>
        <span className="text-muted-foreground"> or drag files here</span>
      </div>
      {!compact && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(mediaOnly(e.target.files))
          // picking the same files again should still fire
          e.target.value = ""
        }}
      />
    </div>
  )
}

export function UploadProgress({
  value,
  label,
  detail,
}: {
  value: number
  label: string
  detail?: string
}) {
  return (
    <div className="space-y-1.5">
      <Progress value={value} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}…</span>
        <span>{detail}</span>
      </div>
    </div>
  )
}
