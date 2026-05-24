"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { Category, Album } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, Trash2, Link } from "lucide-react"
import { toast } from "sonner"

export default function CmsPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  // category form
  const [catName, setCatName] = useState("")
  const [catCreating, setCatCreating] = useState(false)

  // link album to category
  const [linkAlbumId, setLinkAlbumId] = useState("")
  const [linkCatId, setLinkCatId] = useState("")
  const [linking, setLinking] = useState(false)

  const fetchAll = () => {
    if (!user) return
    setLoading(true)
    Promise.all([
      apiFetch<Category[]>("/categories"),
      apiFetch<Album[]>(`/albums/?user_id=${user.id}`),
    ])
      .then(([c, a]) => {
        setCategories(c)
        setAlbums(a)
      })
      .catch(() => {
        setCategories([])
        setAlbums([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const createCategory = async () => {
    if (!catName.trim()) return
    setCatCreating(true)
    try {
      await apiFetch(`/categories?name=${encodeURIComponent(catName)}`, { method: "POST" })
      toast.success("Category created")
      setCatName("")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create category")
    } finally {
      setCatCreating(false)
    }
  }

  const deleteCategory = async (id: number) => {
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" })
      toast.success("Category deleted")
      fetchAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete category")
    }
  }

  const linkAlbum = async () => {
    if (!linkAlbumId || !linkCatId) return
    setLinking(true)
    try {
      await apiFetch("/album-categories", {
        method: "POST",
        body: JSON.stringify({
          album_id: Number(linkAlbumId),
          category_id: Number(linkCatId),
        }),
      })
      toast.success("Album linked to category")
      setLinkAlbumId("")
      setLinkCatId("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link album")
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* categories */}
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>New Category</Label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category name"
              className="w-56"
            />
          </div>
          <Button onClick={createCategory} disabled={catCreating} size="sm">
            <Plus className="size-3.5" />
            {catCreating ? "Creating..." : "Create"}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &quot;{c.name}&quot;.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => deleteCategory(c.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && categories.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">No categories yet</p>
        )}

        {/* link album to category */}
        <div className="rounded-none border border-border p-4">
          <h3 className="mb-3 text-sm font-medium">Link Album to Category</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Album</Label>
              <Select value={linkAlbumId} onValueChange={(v) => setLinkAlbumId(v as string)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select album" />
                </SelectTrigger>
                <SelectContent>
                  {albums.map((a) => (
                    <SelectItem key={a.album_id} value={String(a.album_id)}>
                      {a.album_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={linkCatId} onValueChange={(v) => setLinkCatId(v as string)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={linkAlbum} disabled={linking} size="sm">
              <Link className="size-3.5" />
              {linking ? "Linking..." : "Link"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
