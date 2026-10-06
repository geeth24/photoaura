"use client"

import { Clock } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Props = {
  value: string // HH:MM, 24-hour, or "" when empty
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  className?: string
}

// the list reads like an event day: 5 AM first, after-midnight finishes last
const SLOTS = Array.from({ length: 96 }, (_, i) => {
  const q = (i + 20) % 96
  return `${String(Math.floor(q / 4)).padStart(2, "0")}:${String((q % 4) * 15).padStart(2, "0")}`
})

export function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return value
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

export function TimePicker({ value, onChange, disabled, invalid, placeholder = "Pick a time", className }: Props) {
  // an odd saved time (e.g. 4:10) stays selectable alongside the quarter-hours
  const slots = value && !SLOTS.includes(value) ? [value, ...SLOTS] : SLOTS

  return (
    <Select value={value || null} onValueChange={(v) => onChange(v ?? "")} disabled={disabled}>
      <SelectTrigger aria-invalid={invalid || undefined} className={cn("w-full justify-between px-3 data-[size=default]:h-10", className)}>
        <SelectValue placeholder={placeholder}>
          {(v: string | null) => (
            <span className={cn("flex items-center gap-2", !v && "text-text-faint")}>
              <Clock className="size-4 text-text-muted" />
              {v ? formatTime(v) : placeholder}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {slots.map((slot) => (
          <SelectItem key={slot} value={slot}>
            {formatTime(slot)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
