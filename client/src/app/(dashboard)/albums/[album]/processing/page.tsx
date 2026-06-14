"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import { getUploadStatus, type UploadStatus } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Check,
  Loader2,
  ScanFace,
  Sparkles,
  Users,
  Zap,
  ImageIcon,
  AlertCircle,
  ArrowRight,
} from "lucide-react"

const PHASES = ["saving", "faces", "clustering", "warming", "done"] as const

type StepDef = {
  key: (typeof PHASES)[number]
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  facesOnly?: boolean
}

const STEPS: StepDef[] = [
  { key: "saving", label: "Saving photos", hint: "Uploading to storage", icon: ImageIcon },
  { key: "faces", label: "Detecting faces", hint: "Finding people in each photo", icon: ScanFace, facesOnly: true },
  { key: "clustering", label: "Grouping people", hint: "Matching the same person across photos", icon: Users, facesOnly: true },
  { key: "warming", label: "Optimizing delivery", hint: "Pre-rendering for fast loads", icon: Zap },
]

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ album: string }>
}) {
  const { album: slug } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role !== "client"

  const [status, setStatus] = useState<UploadStatus | null>(null)
  const [failedToLoad, setFailedToLoad] = useState(false)
  const redirectedRef = useRef(false)

  // clients don't need the progress view — it'll be done by the time they look
  useEffect(() => {
    if (user && !isAdmin) router.replace(`/albums/${slug}`)
  }, [user, isAdmin, slug, router])

  // poll the background job until it finishes
  useEffect(() => {
    if (user && !isAdmin) return
    let active = true
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      try {
        const s = await getUploadStatus(slug)
        if (!active) return
        setStatus(s)
        if (s.finished) return
      } catch {
        if (!active) return
        setFailedToLoad(true)
      }
      timer = setTimeout(tick, 1500)
    }
    tick()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [slug, user, isAdmin])

  // once done, drift to the album so the admin lands where the work is
  useEffect(() => {
    if (status?.finished && !status.error && !redirectedRef.current) {
      redirectedRef.current = true
      const t = setTimeout(() => router.replace(`/albums/${slug}`), 2200)
      return () => clearTimeout(t)
    }
  }, [status, slug, router])

  const faces = status?.face_detection ?? true
  const isResync = status?.kind === "resync"
  const steps = STEPS.filter((s) =>
    isResync ? s.key === "faces" || s.key === "clustering" : faces || !s.facesOnly
  )
  const phaseIdx = status ? PHASES.indexOf(status.phase) : 0
  const finished = status?.finished ?? false
  const errored = !!status?.error || failedToLoad

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            {finished && !errored ? (
              <Check className="h-6 w-6 text-primary" />
            ) : errored ? (
              <AlertCircle className="h-6 w-6 text-destructive" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {errored
                ? "Processing hit a snag"
                : finished
                  ? isResync
                    ? "Faces updated"
                    : "All done"
                  : isResync
                    ? "Re-detecting faces"
                    : "Processing your album"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {errored
                ? "Some background steps didn’t finish."
                : finished
                  ? isResync
                    ? "People have been regrouped."
                    : "Your photos are ready to view."
                  : isResync
                    ? "Finding people across the album. You can leave this page — it keeps running."
                    : "Your photos are saved. The rest runs in the background — you can leave this page."}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          {steps.map((step) => {
            const idx = PHASES.indexOf(step.key)
            const state: "done" | "active" | "pending" = finished
              ? "done"
              : idx < phaseIdx
                ? "done"
                : idx === phaseIdx
                  ? "active"
                  : "pending"
            const showCount =
              state === "active" &&
              (step.key === "faces" || step.key === "warming") &&
              (status?.total ?? 0) > 0
            const pct = showCount
              ? Math.round(((status?.current ?? 0) / (status?.total || 1)) * 100)
              : 0

            return (
              <div
                key={step.key}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3.5"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    state === "done"
                      ? "bg-primary/15 text-primary"
                      : state === "active"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {state === "done" ? (
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <Check className="h-4 w-4" />
                    </motion.span>
                  ) : state === "active" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-medium ${
                        state === "pending" ? "text-muted-foreground" : ""
                      }`}
                    >
                      {step.label}
                    </p>
                    {showCount && (
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {status?.current}/{status?.total}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{step.hint}</p>
                  {showCount && <Progress value={pct} className="mt-2 h-1" />}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Button
            render={<Link href={`/albums/${slug}`} />}
            variant={finished && !errored ? "default" : "outline"}
          >
            {finished ? "View album" : "Go to album"}
            <ArrowRight className="h-4 w-4" />
          </Button>
          {!finished && !errored && (
            <span className="text-xs text-muted-foreground">
              Safe to leave — this keeps running.
            </span>
          )}
        </div>
      </motion.div>
    </div>
  )
}
