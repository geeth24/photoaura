"use client"

import Image from "next/image"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { src, type DemoPhoto } from "@/lib/demo"

// the same small pieces the gallery app is built from, so the demos read as the product
export const chipButton =
  "flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors"
export const chipIdle =
  "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
export const chipActive = "border-brand text-brand"

export const brandButton =
  "group flex h-12 cursor-pointer items-center justify-center gap-2 bg-brand px-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-colors hover:bg-text-primary"
export const ghostButton =
  "group flex h-12 items-center justify-center gap-2 border border-border-default px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="block h-px w-12 shrink-0 bg-brand" />
      <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">{children}</span>
    </div>
  )
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "pb-[0.1em] font-heading text-[clamp(2.1rem,3.7vw,3.4rem)] leading-[1] tracking-tight text-text-primary",
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[15px] font-light leading-[1.8] text-text-secondary", className)}>{children}</p>
}

export function Tile({
  photo,
  picked,
  onPick,
  sizes = "(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 240px",
  className,
}: {
  photo: DemoPhoto
  picked?: boolean
  onPick?: () => void
  sizes?: string
  className?: string
}) {
  return (
    <div className={cn("group relative aspect-square overflow-hidden bg-surface-elevated", className)}>
      <Image
        src={src(photo.id)}
        alt={photo.alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
      {(photo.version ?? 1) > 1 && (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-white backdrop-blur">
          v{photo.version}
        </span>
      )}
      {onPick && (
        <button
          type="button"
          onClick={onPick}
          aria-label={picked ? "Remove from picks" : "Add to picks"}
          aria-pressed={picked}
          className={cn(
            "absolute bottom-1.5 left-1.5 flex items-center justify-center rounded-full bg-black/35 p-1.5 text-white transition-opacity",
            picked ? "opacity-100" : "opacity-0 group-hover:opacity-100 max-sm:opacity-0",
          )}
        >
          <Heart className="size-3.5" fill={picked ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  )
}
