"use client"

import { Download } from "lucide-react"
import { downloadOriginal, downloadOptimized } from "@/lib/download"
import { isVideo, type Photo } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

const hint = "text-[10px] uppercase tracking-[0.15em] text-text-faint"

// download button with an Original / Optimized chooser
export function DownloadMenu({ photo, slug }: { photo: Photo; slug?: string }) {
  const m = photo.file_metadata
  const dims = m.width && m.height ? `${m.width} × ${m.height}` : "full size"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label="Download"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full p-2 text-white/90 transition-colors hover:bg-white/10"
          >
            <Download className="size-5" />
          </button>
        }
      />
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className={hint}>Download</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => downloadOriginal(photo, slug)}>
          <span className="flex-1">Original</span>
          <span className={hint}>{dims}</span>
        </DropdownMenuItem>
        {!isVideo(photo) && (
          <DropdownMenuItem onClick={() => downloadOptimized(photo)}>
            <span className="flex-1">Optimized</span>
            <span className={hint}>web</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
