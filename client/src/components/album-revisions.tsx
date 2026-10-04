"use client"

import { useCallback, useEffect, useState } from "react"
import { listRevisions, resendRevisionEmail } from "@/lib/api"
import type { RevisionWithFiles } from "@/lib/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Eye, Loader2, Mail, MailCheck } from "lucide-react"
import { toast } from "sonner"

export function fmtWhen(iso: string | null, withTime = false) {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ""
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : null),
  })
}

// admin-only: every revision pushed to this album, newest first
export function AlbumRevisions({
  albumSlug,
  latest,
  onShow,
}: {
  albumSlug: string
  // the album's latest revision number, so a new push refetches
  latest: number
  onShow?: (number: number, filenames: string[]) => void
}) {
  const [revisions, setRevisions] = useState<RevisionWithFiles[] | null>(null)
  const [sending, setSending] = useState<number | null>(null)

  const load = useCallback(() => {
    listRevisions(albumSlug)
      .then(setRevisions)
      .catch(() => setRevisions([]))
  }, [albumSlug])

  useEffect(() => {
    load()
  }, [load, latest])

  const resend = async (number: number) => {
    setSending(number)
    try {
      const res = await resendRevisionEmail(albumSlug, number)
      toast.success(
        `Sent to ${res.to.length} ${res.to.length === 1 ? "person" : "people"}`,
      )
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the email")
    } finally {
      setSending(null)
    }
  }

  if (!revisions?.length) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="block h-px w-12 bg-brand" />
        <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
          Revisions
        </span>
      </div>

      <div className="divide-y divide-border-subtle border border-border-subtle">
        {revisions.map((r) => (
          <div
            key={r.number}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4"
          >
            <div className="flex min-w-0 items-baseline gap-4">
              <span className="font-heading text-2xl leading-none text-text-primary">
                {r.number}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-text-primary">
                  Revision {r.number}
                  <span className="text-text-muted">
                    {" · "}
                    {r.photo_count} {r.photo_count === 1 ? "photo" : "photos"}
                    {" · "}
                    {fmtWhen(r.created_at)}
                  </span>
                </p>
                {r.note && (
                  <p className="mt-1 truncate text-[13px] font-light text-text-secondary">
                    {r.note}
                  </p>
                )}
                <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-text-faint">
                  {r.notified_at ? (
                    <>
                      <MailCheck className="size-3 text-brand" />
                      Emailed {fmtWhen(r.notified_at, true)}
                    </>
                  ) : (
                    <>
                      <Mail className="size-3" />
                      Not emailed
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onShow && r.filenames.length > 0 && (
                <button
                  onClick={() => onShow(r.number, r.filenames)}
                  className="flex h-9 items-center gap-2 border border-border-default px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  <Eye className="size-3.5" />
                  Show
                </button>
              )}
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <button
                      disabled={sending === r.number}
                      className="flex h-9 items-center gap-2 border border-border-default px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                    >
                      {sending === r.number ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Mail className="size-3.5" />
                      )}
                      {r.notified_at ? "Resend email" : "Send email"}
                    </button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Email revision {r.number}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Everyone with access to this album gets a sign-in link that opens
                      straight on the {r.photo_count} updated{" "}
                      {r.photo_count === 1 ? "photo" : "photos"}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => resend(r.number)}>Send</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
