"use client"

import { useState } from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Props = {
  value: string // YYYY-MM-DD, or "" when empty
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  max?: string
  className?: string
}

function toDate(value: string) {
  return value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
}

export function DatePicker({ value, onChange, disabled, invalid, placeholder = "Pick a date", max, className }: Props) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)
  const maxDate = toDate(max ?? "")
  const thisYear = new Date().getFullYear()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex w-full items-center justify-between gap-2 border border-input px-3 text-left outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-text-faint")}>
          {selected ? format(selected, "EEE, MMM d, yyyy") : placeholder}
        </span>
        <CalendarIcon className="size-4 shrink-0 text-text-muted" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? maxDate}
          captionLayout="dropdown"
          startMonth={new Date(thisYear - 2, 0)}
          endMonth={maxDate ?? new Date(thisYear + 3, 11)}
          disabled={maxDate ? { after: maxDate } : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "")
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
