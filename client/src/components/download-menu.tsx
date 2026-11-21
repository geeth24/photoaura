"use client"

import { Download } from "lucide-react"
import { toast } from "sonner"
import { usePreview } from "@/context/auth-context"
import { downloadOriginal, downloadOptimized } from "@/lib/download"
import { isVideo, type Photo } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

const hint = "text-[10px] uppercase tracking-[0.15em] text-text-faint"

// download button with an Original / Optimized chooser
export function DownloadMenu({ photo, slug }: { photo: Photo; slug?: string }) {
  const { isPreview } = usePreview()
  const m = photo.file_metadata
  // a preview only shows that downloads are offered; the server has them read-only anyway
  const run = (fn: () => void) => (isPreview ? toast.info("Downloads are off while previewing") : fn())
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
        <span className={`block px-2 py-1.5 ${hint}`}>Download</span>
        <DropdownMenuItem onClick={() => run(() => downloadOriginal(photo, slug))}>
          <span className="flex-1">Original</span>
          <span className={`whitespace-nowrap ${hint}`}>{dims}</span>
        </DropdownMenuItem>
        {!isVideo(photo) && (
          <DropdownMenuItem onClick={() => run(() => downloadOptimized(photo))}>
            <span className="flex-1">Optimized</span>
            <span className={hint}>web</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
