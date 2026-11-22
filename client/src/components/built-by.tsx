import { RadSoftMark } from "@/components/icons"
import { cn } from "@/lib/utils"

export function BuiltByRadSoft({ className }: { className?: string }) {
  return (
    <a
      href="https://radsoftinc.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-text-faint transition-colors hover:text-text-primary",
        className,
      )}
    >
      <span>Built by</span>
      <RadSoftMark className="size-2.5 text-text-muted transition-colors group-hover:text-brand" />
      <span className="text-text-muted transition-colors group-hover:text-text-primary">Rad Soft</span>
    </a>
  )
}
