"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { toast } from "sonner"
import { ArrowLeft, Check, FileText, Loader2, Search, Send, UserPlus, Users, X } from "lucide-react"
import { apiFetch, bookingsApi } from "@/lib/api"
import { EVENT_TYPES, money } from "@/lib/bookings"
import type { Booking, BookingInput, BookingPackage, BookingPreview, User } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select"
import { ContractView } from "@/components/contract-view"
import { cn } from "@/lib/utils"

const eyebrow = "text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted"
const micro = "text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted"
const field = "h-10 bg-surface-elevated text-sm md:text-sm"
const hint = "text-[12px] leading-snug text-text-muted"
const brandButton =
  "flex h-11 items-center justify-center gap-2 bg-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_40px_rgba(0,166,251,0.3)] disabled:pointer-events-none disabled:opacity-50"
const secondaryButton =
  "flex h-11 items-center justify-center gap-2 border border-border-default px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"

const toCents = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""))
  return s.trim() && Number.isFinite(n) ? Math.round(n * 100) : undefined
}
const toDollars = (c: number | null | undefined) => (c == null ? "" : String(c / 100))

type Client = Pick<User, "id" | "full_name" | "user_email">

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border border-border-subtle bg-surface-elevated p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <span className="block h-px w-8 bg-brand" />
        <span className={eyebrow}>{title}</span>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  error,
  note,
  children,
  className,
  group,
}: {
  label: string
  error?: string | null
  note?: React.ReactNode
  children: React.ReactNode
  className?: string
  // a group of buttons can't sit inside a <label>
  group?: boolean
}) {
  const Tag = group ? "div" : "label"
  return (
    <Tag className={cn("grid content-start gap-1.5", className)}>
      <span className={micro}>{label}</span>
      {children}
      {error ? (
        <span className="text-[12px] text-destructive">{error}</span>
      ) : note ? (
        <span className={hint}>{note}</span>
      ) : null}
    </Tag>
  )
}

export function BookingForm({ initial }: { initial?: Booking }) {
  const router = useRouter()
  const editing = !!initial
  // everything in the agreement is frozen once the client has signed
  const locked = !!initial && initial.status !== "draft" && initial.status !== "sent"

  const [packages, setPackages] = useState<BookingPackage[] | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing")
  const [clientId, setClientId] = useState<number | null>(initial?.client.user_id ?? null)
  const [clientQuery, setClientQuery] = useState("")
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [phone, setPhone] = useState(initial?.client.phone ?? "")

  const [eventType, setEventType] = useState(initial?.event.type ?? "")
  const [date, setDate] = useState(initial?.event.date ?? "")
  const [start, setStart] = useState(initial?.event.start_time ?? "")
  const [end, setEnd] = useState(initial?.event.end_time ?? "")
  const [location, setLocation] = useState(initial?.event.location ?? "")

  const [packageKey, setPackageKey] = useState(initial?.package.key ?? "event-photo")
  // null = untouched, which shows the package minimum
  const [hoursInput, setHours] = useState<string | null>(
    initial?.package.hours != null ? String(initial.package.hours) : null,
  )
  const [fee, setFee] = useState(initial?.package.fee_overridden ? toDollars(initial.money.total_fee) : "")
  const [video, setVideo] = useState(initial?.package.includes_video ?? false)
  const [revisions, setRevisions] = useState(initial ? String(initial.package.revisions) : "1")
  // only shown (and sent) for flat packages; hourly ones bill overtime at their own rate
  const [overtimeRate, setOvertimeRate] = useState(toDollars(initial?.package.hourly_rate_cents))
  const [packageName, setPackageName] = useState(initial?.package.key === "custom" ? initial.package.name : "")

  const [details, setDetails] = useState(initial?.details_for_client ?? "")
  const [notes, setNotes] = useState(initial?.notes_internal ?? "")

  const [preview, setPreview] = useState<BookingPreview | null>(null)
  // the body the current preview was rendered from; anything else means one is in flight
  const [previewedKey, setPreviewedKey] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState<"draft" | "send" | null>(null)
  const run = useRef(0)

  useEffect(() => {
    bookingsApi
      .packages()
      .then(setPackages)
      .catch(() => setPackages([]))
    apiFetch<(User & { parent_user_id?: number | null })[]>("/users/")
      .then((us) => setClients(us.filter((u) => u.role === "client" && !u.parent_user_id)))
      .catch(() => setClients([]))
  }, [])

  const pkg = packages?.find((p) => p.key === packageKey) ?? null
  const hourly = pkg?.pricing === "hourly"
  const custom = packageKey === "custom"
  const minHours = pkg?.min_hours ?? 0
  const hours = hoursInput ?? (hourly && minHours ? String(minHours) : "")
  const hoursNum = Number(hours)
  const autoFee = pkg ? (hourly ? pkg.rate_cents * (hoursNum || minHours) : pkg.rate_cents) : 0

  const selectedClient =
    clients.find((c) => c.id === clientId) ??
    (initial && clientId === initial.client.user_id
      ? { id: initial.client.user_id, full_name: initial.client.full_name, user_email: initial.client.email }
      : null)
  const matches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    const list = q ? clients.filter((c) => `${c.full_name} ${c.user_email}`.toLowerCase().includes(q)) : clients
    return list.slice(0, 6)
  }, [clients, clientQuery])

  const overrideCents = toCents(fee)
  const body = useMemo<BookingInput>(() => {
    const b: BookingInput = {
      client_phone: phone.trim(),
      event_type: eventType.trim(),
      start_time: start,
      end_time: end,
      location: location.trim(),
      package_key: packageKey,
      details_for_client: details.trim(),
      notes_internal: notes.trim(),
    }
    // the API parses this as a date, so a half-filled form leaves it out
    if (date) b.event_date = date
    if (clientMode === "new") b.client = { full_name: newName.trim(), email: newEmail.trim() }
    else if (clientId) b.client_user_id = clientId
    if (hourly) b.hours = hoursNum || undefined
    // null clears an earlier override back to the package price
    b.total_fee_cents = overrideCents ?? null
    if (custom) {
      b.includes_video = video
      b.revisions = Number(revisions) || 0
      if (packageName.trim()) b.package_name = packageName.trim()
    }
    if (!hourly) {
      const r = toCents(overtimeRate)
      if (r != null) b.hourly_rate_cents = r
    }
    return b
  }, [
    phone,
    eventType,
    date,
    start,
    end,
    location,
    packageKey,
    details,
    notes,
    clientMode,
    newName,
    newEmail,
    clientId,
    hourly,
    hoursNum,
    overrideCents,
    custom,
    video,
    revisions,
    packageName,
    overtimeRate,
  ])

  // live amounts + contract, debounced so typing doesn't hammer the API
  const bodyKey = JSON.stringify(body)
  const previewing = !!packages && !locked && previewedKey !== bodyKey
  useEffect(() => {
    // a signed agreement is fixed; nothing to re-render
    if (!packages || locked) return
    const id = ++run.current
    const t = setTimeout(() => {
      bookingsApi
        .preview({ ...JSON.parse(bodyKey), number: initial?.number })
        .then((p) => {
          if (id !== run.current) return
          setPreview(p)
          setPreviewError(null)
        })
        .catch((e) => id === run.current && setPreviewError(e instanceof Error ? e.message : "Preview failed"))
        .finally(() => id === run.current && setPreviewedKey(bodyKey))
    }, 450)
    return () => clearTimeout(t)
  }, [bodyKey, packages, locked, initial?.number])

  const errors = {
    client:
      clientMode === "existing"
        ? !clientId && "Pick a client"
        : (!newName.trim() && "Name is required") ||
          (!/^\S+@\S+\.\S+$/.test(newEmail.trim()) && "A valid email is required"),
    eventType: !eventType.trim() && "Pick or type an event type",
    date: !date && "Pick the date",
    start: !start && "Required",
    end: (!end && "Required") || (start && end && end <= start && "Ends before it starts"),
    location: !location.trim() && "Where is it?",
    hours: hourly && (!hoursNum || hoursNum < minHours) && `At least ${minHours} hours for this package`,
    fee:
      custom && !overrideCents
        ? "Enter the fee for a custom package"
        : fee.trim() && overrideCents == null
          ? "Not a valid amount"
          : null,
  }
  const invalid = Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => (tried ? errors[k] || null : null)

  const save = async (send: boolean) => {
    setTried(true)
    if (invalid) {
      toast.error("A few fields need attention")
      return
    }
    setSaving(send ? "send" : "draft")
    try {
      const saved = initial
        ? await bookingsApi.update(initial.number, locked ? lockedBody(body) : body)
        : await bookingsApi.create(body)
      if (send) await bookingsApi.send(saved.number)
      toast.success(
        send
          ? `${saved.number} sent to ${saved.client.full_name}`
          : editing
            ? `${saved.number} saved`
            : `${saved.number} saved as a draft`,
      )
      router.push(`/bookings/${saved.number}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the booking")
      setSaving(null)
    }
  }

  const groups = useMemo(() => {
    const m = new Map<string, BookingPackage[]>()
    for (const p of packages ?? []) m.set(p.category, [...(m.get(p.category) ?? []), p])
    return [...m.entries()]
  }, [packages])

  const sendLabel =
    !initial || initial.status === "draft" ? "Save & send" : initial.status === "sent" ? "Save & resend" : null
  const shown = locked && initial ? signedPreview(initial) : preview
  const amounts = shown?.amounts

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href={initial ? `/bookings/${initial.number}` : "/bookings"}
          className="group mb-4 flex items-center gap-4 text-text-muted transition-colors hover:text-text-primary"
        >
          <span className="block h-px w-12 bg-brand" />
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.35em]">
            <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
            {initial ? initial.number : "Bookings"}
          </span>
        </Link>
        <h1 className="font-heading text-[clamp(2.25rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-text-primary">
          {initial ? "Edit booking" : "New booking"}
        </h1>
        <p className="mt-3 max-w-xl text-sm font-light text-text-secondary">
          {locked
            ? "The client has signed, so the agreement is locked. You can still update the details for the client and your notes."
            : initial?.status === "sent"
              ? "This agreement is out for signature. Saving changes re-renders it, and the client will need to review it again."
              : "The agreement fills itself in as you go. Save a draft, or send it to the client to sign."}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <Section title="Client">
            {!editing && (
              <div className="flex gap-2">
                {(["existing", "new"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setClientMode(m)}
                    className={cn(
                      "flex h-9 items-center gap-2 border px-3.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors",
                      clientMode === m
                        ? "border-brand text-brand"
                        : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
                    )}
                  >
                    {m === "existing" ? <Users className="size-3.5" /> : <UserPlus className="size-3.5" />}
                    {m === "existing" ? "Existing client" : "New client"}
                  </button>
                ))}
              </div>
            )}

            {clientMode === "existing" ? (
              selectedClient ? (
                <div className="flex items-center justify-between gap-3 border border-border-default bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{selectedClient.full_name}</p>
                    <p className="truncate text-[12px] text-text-muted">{selectedClient.user_email}</p>
                  </div>
                  {!editing && (
                    <button
                      onClick={() => setClientId(null)}
                      className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-primary"
                    >
                      <X className="size-3" /> Change
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-faint" />
                    <Input
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      placeholder="Search clients by name or email"
                      aria-invalid={!!show("client")}
                      className={cn(field, "pl-9")}
                    />
                  </div>
                  <div className="max-h-56 divide-y divide-border-subtle overflow-y-auto border border-border-subtle">
                    {matches.length === 0 ? (
                      <p className="px-3 py-3 text-sm font-light text-text-muted">
                        No match.{" "}
                        <button onClick={() => setClientMode("new")} className="text-brand hover:underline">
                          Add them as a new client
                        </button>
                      </p>
                    ) : (
                      matches.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setClientId(c.id)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-text-primary">{c.full_name}</span>
                            <span className="block truncate text-[11px] text-text-muted">{c.user_email}</span>
                          </span>
                          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-brand">
                            Pick
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  {show("client") && <p className="text-[12px] text-destructive">{show("client")}</p>}
                </div>
              )
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={show("client") && !newName.trim() ? "Name is required" : null}>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Priya Raman"
                    className={field}
                  />
                </Field>
                <Field
                  label="Email"
                  error={show("client") && newName.trim() ? show("client") : null}
                  note="If they already have an account, the booking goes on it."
                >
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="priya@example.com"
                    className={field}
                  />
                </Field>
              </div>
            )}
            <Field label="Phone" note="Printed on the agreement.">
              <Input
                type="tel"
                value={phone}
                disabled={locked}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(214) 555-0100"
                className={cn(field, "sm:max-w-xs")}
              />
            </Field>
          </Section>

          <Section title="Event">
            <Field label="Event type" error={show("eventType")} group>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.filter((t) => t !== "Other").map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={locked}
                    onClick={() => setEventType(t)}
                    className={cn(
                      "h-8 border px-3 text-[12px] transition-colors disabled:pointer-events-none disabled:opacity-50",
                      eventType === t
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input
                value={eventType}
                disabled={locked}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="Or type your own, e.g. Sangeet"
                aria-invalid={!!show("eventType")}
                className={cn(field, "mt-1 sm:max-w-sm")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date" error={show("date")}>
                <Input
                  type="date"
                  value={date}
                  disabled={locked}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={!!show("date")}
                  className={field}
                />
              </Field>
              <Field label="Starts" error={show("start")}>
                <Input
                  type="time"
                  value={start}
                  disabled={locked}
                  onChange={(e) => setStart(e.target.value)}
                  aria-invalid={!!show("start")}
                  className={field}
                />
              </Field>
              <Field label="Ends" error={show("end")}>
                <Input
                  type="time"
                  value={end}
                  disabled={locked}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-invalid={!!show("end")}
                  className={field}
                />
              </Field>
            </div>
            <Field label="Location" error={show("location")} note="Add more than one stop if the day moves around.">
              <Input
                value={location}
                disabled={locked}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Venue name and address"
                aria-invalid={!!show("location")}
                className={field}
              />
            </Field>
          </Section>

          <Section title="Package & fee">
            {packages == null ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Field label="Package">
                  <NativeSelect
                    value={packageKey}
                    disabled={locked}
                    onChange={(e) => {
                      setPackageKey(e.target.value)
                      setFee("")
                      setHours(null)
                    }}
                    className="w-full [&_select]:h-10 [&_select]:bg-surface-elevated [&_select]:text-sm"
                  >
                    {groups.map(([cat, list]) => (
                      <NativeSelectOptGroup key={cat} label={cat}>
                        {list.map((p) => (
                          <NativeSelectOption key={p.key} value={p.key}>
                            {p.key === "custom"
                              ? "Custom — set the fee"
                              : `${p.name} · ${money(p.rate_cents).replace(/\.00$/, "")}${p.pricing === "hourly" ? "/hr" : ""}`}
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    ))}
                  </NativeSelect>
                </Field>
                {hourly && (
                  <Field
                    label="Hours"
                    error={show("hours") || (hoursNum > 0 && hoursNum < minHours ? `Minimum ${minHours}` : null)}
                  >
                    <Input
                      type="number"
                      min={minHours}
                      step={0.5}
                      value={hours}
                      disabled={locked}
                      onChange={(e) => setHours(e.target.value)}
                      onBlur={() => hoursNum < minHours && setHours(String(minHours))}
                      aria-invalid={hoursNum > 0 && hoursNum < minHours}
                      className={field}
                    />
                  </Field>
                )}
              </div>
            )}
            {pkg && (
              <p className={hint}>
                {pkg.includes_video || (custom && video) ? "Photo + video" : "Photos only"} ·{" "}
                {custom ? Number(revisions) || 0 : pkg.revisions} revision{" "}
                {(custom ? Number(revisions) : pkg.revisions) === 1 ? "round" : "rounds"}
                {hourly && ` · ${money(pkg.rate_cents)}/hr, ${minHours} hr minimum`}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={custom ? "Fee" : "Fee override"}
                error={show("fee")}
                note={
                  custom ? null : overrideCents != null ? (
                    <button type="button" onClick={() => setFee("")} className="text-brand hover:underline">
                      Use the package price ({money(autoFee)})
                    </button>
                  ) : (
                    "Leave empty to use the package price."
                  )
                }
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">
                    $
                  </span>
                  <Input
                    inputMode="decimal"
                    value={fee}
                    disabled={locked}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder={custom ? "0.00" : (autoFee / 100).toFixed(2)}
                    aria-invalid={!!show("fee")}
                    className={cn(field, "pl-6 tabular-nums")}
                  />
                </div>
              </Field>
              {!hourly && (
                <Field label="Overtime rate" note="Per hour, quoted in the overtime clause.">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">
                      $
                    </span>
                    <Input
                      inputMode="decimal"
                      value={overtimeRate}
                      disabled={locked}
                      onChange={(e) => setOvertimeRate(e.target.value)}
                      placeholder={pkg?.includes_video || (custom && video) ? "300.00" : "150.00"}
                      className={cn(field, "pl-6 tabular-nums")}
                    />
                  </div>
                </Field>
              )}
            </div>

            {custom && (
              <Field label="Package name" note="Printed on the agreement and the client's page.">
                <Input
                  value={packageName}
                  disabled={locked}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="Custom Package"
                  className={cn(field, "sm:max-w-sm")}
                />
              </Field>
            )}
            {custom && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-4 border border-border-default px-4 py-3">
                  <div>
                    <p className="text-sm text-text-primary">Includes video</p>
                    <p className="text-[12px] text-text-muted">Adds the video clauses to the agreement</p>
                  </div>
                  <Switch checked={video} onCheckedChange={setVideo} disabled={locked} />
                </div>
                <Field label="Revision rounds">
                  <Input
                    type="number"
                    min={0}
                    value={revisions}
                    disabled={locked}
                    onChange={(e) => setRevisions(e.target.value)}
                    className={cn(field, "sm:max-w-[120px]")}
                  />
                </Field>
              </div>
            )}
          </Section>

          <Section title="Notes">
            <Field
              label="Details for the client"
              note="Shown on their booking page, e.g. the run of show or what to bring."
            >
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={"Baraat at 2:00, ceremony 3:30, reception 6:30.\nPlease send a shot list a week before."}
                className="min-h-24 bg-surface-elevated text-sm md:text-sm"
              />
            </Field>
            <Field label="Internal notes" note="Only you see these.">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Second shooter, referral, venue rules…"
                className="min-h-20 bg-surface-elevated text-sm md:text-sm"
              />
            </Field>
          </Section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button onClick={() => save(false)} disabled={!!saving} className={secondaryButton}>
              {saving === "draft" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {editing ? "Save changes" : "Save draft"}
            </button>
            {sendLabel && (
              <button onClick={() => save(true)} disabled={!!saving} className={brandButton}>
                {saving === "send" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {sendLabel}
              </button>
            )}
          </div>
        </div>

        {/* live amounts + the agreement as the client will read it */}
        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="border border-border-subtle bg-surface-elevated">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <span className={micro}>Payment schedule</span>
              {previewing && <Loader2 className="size-3.5 animate-spin text-text-faint" />}
            </div>
            <div className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle">
              {[
                { label: "Retainer · 10%", v: amounts?.retainer, when: "On signing" },
                { label: "Event day · 40%", v: amounts?.event_day, when: "After coverage" },
                { label: "Final · 50%", v: amounts?.final, when: "On delivery" },
              ].map((x) => (
                <div key={x.label} className="px-4 py-4 sm:px-5">
                  <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-text-muted sm:text-[10px]">
                    {x.label}
                  </p>
                  <p className="mt-2 font-heading text-xl tabular-nums tracking-tight text-text-primary sm:text-2xl">
                    {x.v != null ? money(x.v) : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-text-faint">{x.when}</p>
                </div>
              ))}
            </div>
            <div className="flex items-baseline justify-between px-5 py-4">
              <span className="text-sm text-text-secondary">Total fee</span>
              <span className="font-heading text-3xl tabular-nums tracking-tight text-brand">
                {amounts ? money(amounts.total_fee) : "—"}
              </span>
            </div>
          </div>

          <div className="border border-border-subtle bg-surface-elevated">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <span className={cn(micro, "flex items-center gap-2")}>
                <FileText className="size-3.5" /> {locked ? "Signed agreement" : "Agreement preview"}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">
                {pkg?.includes_video || (custom && video) ? "Photo & video" : "Photography"}
              </span>
            </div>
            <div className="max-h-[70vh] overflow-y-auto bg-surface px-5 py-6 sm:px-8 xl:max-h-[calc(100dvh-24rem)]">
              {previewError && !shown ? (
                <p className="py-10 text-center text-sm text-text-muted">{previewError}</p>
              ) : shown ? (
                <ContractView
                  markdown={shown.contract_markdown}
                  compact
                  className={cn(previewing && "opacity-60 transition-opacity")}
                />
              ) : (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-5 w-2/3" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-3 w-full" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// after signing only the notes can change
function lockedBody(b: BookingInput): Partial<BookingInput> {
  return { details_for_client: b.details_for_client, notes_internal: b.notes_internal }
}

// what the client actually signed, with the schedule it was signed at
function signedPreview(b: Booking): BookingPreview {
  const pay = (k: string) => b.payments.find((p) => p.kind === k)?.amount_cents ?? 0
  return {
    amounts: {
      total_fee: b.money.total_fee,
      total_due: b.money.total_fee,
      retainer: pay("retainer"),
      event_day: pay("event_day"),
      final: pay("final"),
    },
    contract_markdown: b.contract.markdown ?? "",
  }
}
