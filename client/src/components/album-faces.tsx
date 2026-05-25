"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { Users } from "lucide-react"
import type { AlbumFace } from "@/lib/types"

type Props = {
  faces: AlbumFace[]
  selected: string | null
  onSelect: (faceId: string | null) => void
}

export function AlbumFaces({ faces, selected, onSelect }: Props) {
  if (!faces.length) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4 text-text-muted">
        <span className="block h-px w-12 bg-brand" />
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
          <Users className="size-3" />
          People
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">
          {faces.length}
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {/* clear / all */}
        <button
          onClick={() => onSelect(null)}
          className={`flex size-16 shrink-0 flex-col items-center justify-center border text-[10px] font-medium uppercase tracking-[0.15em] transition-colors sm:size-20 ${
            selected === null
              ? "border-brand text-brand"
              : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text-primary"
          }`}
        >
          All
        </button>

        {faces.map((face, i) => {
          const active = selected === face.face_id
          return (
            <motion.button
              key={face.face_id}
              onClick={() => onSelect(active ? null : face.face_id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: Math.min(i * 0.04, 0.3),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group shrink-0 space-y-1.5 text-center"
              aria-pressed={active}
            >
              <div
                className={`relative size-16 overflow-hidden border transition-all sm:size-20 ${
                  active
                    ? "border-brand shadow-[0_0_30px_rgba(0,166,251,0.25)]"
                    : "border-border-subtle group-hover:border-border-strong"
                }`}
              >
                <Image
                  src={face.image_url}
                  alt={face.name || "Face"}
                  fill
                  sizes="80px"
                  className={`object-cover transition-all duration-500 ${
                    active
                      ? "brightness-110"
                      : "brightness-90 group-hover:brightness-100"
                  }`}
                />
              </div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted">
                {face.name || `${face.count}`}
              </div>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
