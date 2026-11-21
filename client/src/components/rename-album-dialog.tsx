"use client"

import { useState } from "react"
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
import { Pencil } from "lucide-react"

type Props = {
  albumName: string
  onRename: (name: string) => void
}

export function RenameAlbumDialog({ albumName, onRename }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(albumName)

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed !== albumName

  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) setName(albumName)
  }

  const handleSave = () => {
    if (!canSave) return
    onRename(trimmed)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            aria-label="Rename album"
            title="Rename album"
            className="flex size-9 shrink-0 items-center justify-center border border-border-default text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Pencil className="size-3.5" />
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename album</DialogTitle>
          <DialogDescription>
            Only the title changes. Share links and photo URLs stay the same.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="grid gap-1.5"
        >
          <Label htmlFor="rename-album-name">Album name</Label>
          <Input
            id="rename-album-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            autoFocus
          />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
