"use client"

import type { ReactNode } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export const ease = [0.22, 1, 0.36, 1] as const

export const brandButton =
  "flex h-10 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"

export const quietButton =
  "flex h-10 items-center gap-2 border border-border-default px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"

export const microLabel = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className={cn("flex flex-wrap items-end justify-between gap-6", className)}
    >
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-4">
          <span className="block h-px w-12 bg-brand" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            {eyebrow}
          </span>
        </div>
        <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-text-secondary">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  )
}

export function SectionLabel({
  children,
  aside,
  className,
}: {
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-4">
        <span className="block h-px w-8 shrink-0 bg-brand" />
        <h2 className="truncate text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
          {children}
        </h2>
      </div>
      {aside}
    </div>
  )
}

export function FilterTabs<K extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: K; label: string; count?: number }[]
  value: K
  onChange: (key: K) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn("flex max-w-full overflow-x-auto border border-border-default [scrollbar-width:none]", className)}
    >
      {options.map((o, i) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 px-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors",
              i > 0 && "border-l border-border-default",
              active ? "bg-surface-hover text-brand" : "text-text-muted hover:text-text-primary",
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn("tabular-nums", active ? "text-brand/70" : "text-text-faint")}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
