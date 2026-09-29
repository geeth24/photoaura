import { cn } from "@/lib/utils"
import { APP_STORE, PLAY_STORE } from "@/lib/stores"

const badge =
  "inline-flex h-14 items-center gap-2.5 rounded-lg border border-white/20 bg-black px-4 text-white transition-transform hover:scale-[1.02]"

// the standard black App Store badge, drawn inline so it needs no asset
export function AppStoreBadge({ className }: { className?: string }) {
  return (
    <a
      href={APP_STORE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download on the App Store"
      data-store="app-store"
      className={cn(badge, className)}
    >
      <svg viewBox="0 0 24 24" className="size-7 shrink-0 fill-current" aria-hidden>
        <path d="M17.05 12.54c-.03-2.9 2.37-4.3 2.48-4.36-1.35-1.98-3.45-2.25-4.2-2.28-1.79-.18-3.49 1.05-4.4 1.05-.9 0-2.3-1.03-3.79-1-1.95.03-3.75 1.13-4.75 2.88-2.03 3.52-.52 8.73 1.46 11.59.97 1.4 2.12 2.97 3.63 2.91 1.46-.06 2.01-.94 3.77-.94s2.26.94 3.8.91c1.57-.03 2.56-1.42 3.52-2.83 1.11-1.62 1.56-3.19 1.59-3.27-.03-.01-3.05-1.17-3.08-4.66zM14.16 4.02c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.55.77-3.38 1.74-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.63z" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-normal tracking-wide">Download on the</span>
        <span className="mt-0.5 text-[19px] font-semibold tracking-tight">App Store</span>
      </span>
    </a>
  )
}

// drawn to match the App Store badge; Google's official artwork can replace it
export function PlayStoreBadge({ className }: { className?: string }) {
  return (
    <a
      href={PLAY_STORE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get it on Google Play"
      data-store="play"
      className={cn(badge, className)}
    >
      <svg viewBox="0 0 24 24" className="size-6 shrink-0 fill-current" aria-hidden>
        <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-normal uppercase tracking-wide">Get it on</span>
        <span className="mt-0.5 text-[19px] font-semibold tracking-tight">Google Play</span>
      </span>
    </a>
  )
}

// both render on the server; PLATFORM_SCRIPT hides the one a phone can't use
export function StoreBadges({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <AppStoreBadge />
      <PlayStoreBadge />
    </div>
  )
}
