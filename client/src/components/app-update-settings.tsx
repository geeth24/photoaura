"use client"

import { useEffect, useState } from "react"
import { getAppConfig, saveAppConfig } from "@/lib/api"
import type { AppConfig, AppPlatform, AppVersionPolicy } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"

const PLATFORMS: { key: AppPlatform; label: string; storeHint: string }[] = [
  { key: "ios", label: "iPhone & iPad", storeHint: "https://apps.apple.com/app/id…" },
  { key: "android", label: "Android", storeHint: "https://play.google.com/store/apps/details?id=…" },
]

const VERSION = /^\d+(\.\d+){0,2}$/
const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
const field = "h-10 bg-surface-elevated text-sm md:text-sm"

// 2.10 is newer than 2.9
function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

export function AppUpdateSettings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getAppConfig()
      .then(setConfig)
      .catch(() => setFailed(true))
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="block h-px w-8 bg-brand" />
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
          <Smartphone className="size-3" />
          App updates
        </span>
      </div>
      <p className="max-w-2xl text-sm font-light text-text-secondary">
        The iPhone and Android apps check this when they open. Use it to nudge people
        onto a new release, or to stop an old version that no longer works.
      </p>

      {failed ? (
        <div className="border border-dashed border-border-default py-10 text-center text-sm text-text-muted">
          Couldn&apos;t load the current update settings.
        </div>
      ) : !config ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {PLATFORMS.map((p) => (
            <PlatformCard
              key={p.key}
              platform={p.key}
              label={p.label}
              storeHint={p.storeHint}
              initial={config[p.key]}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PlatformCard({
  platform,
  label,
  storeHint,
  initial,
}: {
  platform: AppPlatform
  label: string
  storeHint: string
  initial: AppVersionPolicy | null
}) {
  const [latest, setLatest] = useState(initial?.latest_version ?? "")
  const [min, setMin] = useState(initial?.min_version ?? "")
  const [store, setStore] = useState(initial?.store_url ?? "")
  const [message, setMessage] = useState(initial?.message ?? "")
  const [savedAt, setSavedAt] = useState(initial?.updated_at ?? null)
  const [saving, setSaving] = useState(false)

  const latestBad = !!latest.trim() && !VERSION.test(latest.trim())
  const minBad = !!min.trim() && !VERSION.test(min.trim())
  const minAhead =
    !latestBad && !minBad && !!latest.trim() && !!min.trim() &&
    compareVersions(min.trim(), latest.trim()) > 0
  const error = latestBad || minBad
    ? "Versions look like 2.3 or 2.3.1"
    : minAhead
      ? "The minimum can't be newer than the latest version"
      : null

  const save = async () => {
    if (error || saving) return
    setSaving(true)
    try {
      const res = await saveAppConfig(platform, {
        latest_version: latest.trim() || null,
        min_version: min.trim() || null,
        // "" clears it; null would leave the saved link alone
        store_url: store.trim(),
        message: message.trim() || null,
      })
      setSavedAt(res[platform]?.updated_at ?? new Date().toISOString())
      toast.success(`${label} update settings saved`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 border border-border-subtle bg-surface-elevated p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-heading text-2xl tracking-tight text-text-primary">{label}</h3>
        {savedAt && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">
            Saved{" "}
            {new Date(savedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid content-start gap-1.5">
          <span className={micro}>Latest version</span>
          <Input
            value={latest}
            onChange={(e) => setLatest(e.target.value)}
            placeholder="e.g. 2.4"
            inputMode="decimal"
            aria-invalid={latestBad || minAhead}
            className={field}
          />
          <span className="text-[12px] leading-snug text-text-muted">
            Anyone on an older version gets a nudge to update. They can still skip it.
          </span>
        </label>
        <label className="grid content-start gap-1.5">
          <span className={micro}>Minimum version</span>
          <Input
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="e.g. 2.0"
            inputMode="decimal"
            aria-invalid={minBad || minAhead}
            className={field}
          />
          <span className="text-[12px] leading-snug text-text-muted">
            Anything older is blocked until it updates. Leave empty to never block.
          </span>
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className={micro}>Store link</span>
        <Input
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder={storeHint}
          type="url"
          className={field}
        />
      </label>

      <label className="grid gap-1.5">
        <span className={micro}>Message (optional)</span>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. This update makes saving to your camera roll faster."
          className="bg-surface-elevated text-sm md:text-sm"
        />
        <span className="text-[12px] leading-snug text-text-muted">
          Shown in the update prompt. Leave empty for the default wording.
        </span>
      </label>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-[12px] text-destructive">{error}</span>
        <button
          onClick={save}
          disabled={!!error || saving}
          className="flex h-10 items-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}
