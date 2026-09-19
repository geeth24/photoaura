import { cn } from "@/lib/utils"

const APP_STORE = "https://apps.apple.com/app/id6477320360"

// the standard black App Store badge, drawn inline so it needs no asset
export function AppStoreBadge({ className }: { className?: string }) {
  return (
    <a
      href={APP_STORE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download on the App Store"
      className={cn(
        "inline-flex h-14 items-center gap-2.5 rounded-lg border border-white/20 bg-black px-4 text-white transition-transform hover:scale-[1.02]",
        className,
      )}
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

export { APP_STORE }
