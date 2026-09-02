"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"

const intents = [
  { id: "managed", label: "Managed instance" },
  { id: "studio", label: "For my studio" },
  { id: "selfhost", label: "Self-host help" },
  { id: "other", label: "Something else" },
]

const field =
  "h-11 w-full border border-border-default bg-surface px-3 text-[14px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand"

type Status = "idle" | "sending" | "sent" | "error"

export function ContactDialog({
  children,
  intent = "studio",
}: {
  children: React.ReactNode
  intent?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [status, setStatus] = React.useState<Status>("idle")
  const [error, setError] = React.useState("")
  const [topic, setTopic] = React.useState(intent)

  // a reopened dialog should start clean, not on last week's success screen
  React.useEffect(() => {
    if (!open) return
    setStatus("idle")
    setError("")
    setTopic(intent)
  }, [open, intent])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setStatus("sending")
    setError("")
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          studio: form.get("studio"),
          message: form.get("message"),
          company: form.get("company"),
          intent: topic,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Couldn't send that.")
      setStatus("sent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.")
      setStatus("error")
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border-default bg-surface-elevated shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-start justify-between border-b border-border-subtle px-7 py-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="block h-px w-8 bg-brand" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                        Talk to us
                      </span>
                    </div>
                    <DialogPrimitive.Title className="mt-3 font-heading text-2xl leading-tight tracking-tight text-text-primary">
                      Let&apos;s get your gallery up.
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="mt-2 text-[13px] font-light leading-[1.7] text-text-secondary">
                      Tell us a bit about your studio. We usually reply within a
                      day.
                    </DialogPrimitive.Description>
                  </div>
                  <DialogPrimitive.Close className="-mr-2 -mt-1 p-2 text-text-muted transition-colors hover:text-text-primary">
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                {status === "sent" ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 px-7 py-16 text-center"
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-brand/15">
                      <Check className="size-5 text-brand" />
                    </span>
                    <div>
                      <div className="font-heading text-xl tracking-tight text-text-primary">
                        Message sent.
                      </div>
                      <p className="mt-2 text-[13px] font-light text-text-secondary">
                        We&apos;ll get back to you at the email you gave us.
                      </p>
                    </div>
                    <DialogPrimitive.Close className="mt-2 h-11 border border-border-default px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
                      Close
                    </DialogPrimitive.Close>
                  </motion.div>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-5 px-7 py-6">
                    <div className="flex flex-wrap gap-2">
                      {intents.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => setTopic(it.id)}
                          className={cn(
                            "h-9 border px-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors",
                            topic === it.id
                              ? "border-brand bg-brand/10 text-brand"
                              : "border-border-default text-text-muted hover:border-border-strong hover:text-text-secondary",
                          )}
                        >
                          {it.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
                          Name
                        </span>
                        <input name="name" required className={field} placeholder="Jane Doe" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
                          Email
                        </span>
                        <input
                          name="email"
                          type="email"
                          required
                          className={field}
                          placeholder="jane@studio.com"
                        />
                      </label>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
                        Studio <span className="normal-case tracking-normal">(optional)</span>
                      </span>
                      <input name="studio" className={field} placeholder="Doe Photography" />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-text-muted">
                        What do you need?
                      </span>
                      <textarea
                        name="message"
                        required
                        rows={4}
                        className={cn(field, "h-auto resize-none py-3 leading-[1.7]")}
                        placeholder="How many galleries, roughly how many photos, and where you'd like it to live."
                      />
                    </label>

                    <input
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden
                      className="absolute left-[-9999px] size-0"
                    />

                    {error && (
                      <p className="text-[13px] text-red-400">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="group flex h-12 w-full items-center justify-center gap-2 bg-brand text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)] disabled:opacity-60 disabled:hover:bg-brand disabled:hover:shadow-none"
                    >
                      {status === "sending" ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Sending
                        </>
                      ) : (
                        <>
                          Send message
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
