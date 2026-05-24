"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import type { Face, Photo } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Pencil, ArrowLeft } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

export default function FacesPage() {
  const [faces, setFaces] = useState<Face[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Face | null>(null)
  const [facePhotos, setFacePhotos] = useState<Photo[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editFace, setEditFace] = useState<Face | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchFaces = () => {
    setLoading(true)
    apiFetch<Face[]>("/faces")
      .then(setFaces)
      .catch(() => setFaces([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFaces()
  }, [])

  const viewFace = async (face: Face) => {
    setSelected(face)
    setPhotosLoading(true)
    try {
      const detail = await apiFetch<Face>(`/face/${face.external_id}`)
      setFacePhotos(detail.face_photos || [])
    } catch {
      setFacePhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }

  const openEdit = (face: Face) => {
    setEditFace(face)
    setEditName(face.name || "")
    setEditOpen(true)
  }

  const saveName = async () => {
    if (!editFace) return
    setSaving(true)
    try {
      await apiFetch(`/face/${editFace.external_id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName }),
      })
      toast.success("Name updated")
      setEditOpen(false)
      fetchFaces()
      if (selected?.external_id === editFace.external_id) {
        setSelected({ ...selected, name: editName })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update name")
    } finally {
      setSaving(false)
    }
  }

  // detail view for a face
  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {selected.name || "Unknown"}
          </h1>
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(selected)}>
            <Pencil className="size-3.5" />
          </Button>
        </div>

        {photosLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {facePhotos.map((photo) => (
              <div
                key={photo.compressed_image}
                className="relative aspect-square overflow-hidden rounded-sm bg-muted"
              >
                <Image
                  src={photo.compressed_image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
            ))}
          </div>
        )}

        {!photosLoading && facePhotos.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No photos for this face</p>
        )}

        <EditSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          name={editName}
          onNameChange={setEditName}
          onSave={saveName}
          saving={saving}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Faces</h1>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3">
                <Skeleton className="h-4 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {faces.map((face) => (
            <Card
              key={face.external_id}
              className="group cursor-pointer overflow-hidden transition-colors hover:bg-muted/50"
              onClick={() => viewFace(face)}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {face.image_url ? (
                  <Image
                    src={face.image_url}
                    alt={face.name || "Unknown face"}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-3">
                <p className="truncate text-sm font-medium">
                  {face.name || "Unknown"}
                </p>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(face)
                  }}
                >
                  <Pencil className="size-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && faces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p>No faces found</p>
        </div>
      )}

      <EditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        name={editName}
        onNameChange={setEditName}
        onSave={saveName}
        saving={saving}
      />
    </div>
  )
}

function EditSheet({
  open,
  onOpenChange,
  name,
  onNameChange,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Face</SheetTitle>
          <SheetDescription>Update the name for this face.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 p-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Person name"
            />
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
