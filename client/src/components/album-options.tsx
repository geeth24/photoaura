import type { ComponentProps } from "react"
import type { Album } from "@/lib/types"
import { SelectContent, SelectItem } from "@/components/ui/select"

// every album as a select option, valued by id; `all` adds a catch-all first
export function AlbumOptions({ albums, all, ...props }: { albums: Album[]; all?: string } & ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent {...props}>
      {all && <SelectItem value="all">{all}</SelectItem>}
      {albums.map((a) => (
        <SelectItem key={a.slug} value={String(a.album_id)}>
          {a.album_name}
        </SelectItem>
      ))}
    </SelectContent>
  )
}
