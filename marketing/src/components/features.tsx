"use client"

import { motion } from "motion/react"
import { ScanFace, Cloud, Lock, FolderOpen, Sparkles, Share2 } from "lucide-react"

const features = [
  {
    icon: FolderOpen,
    title: "Editorial galleries",
    body: "Client-ready albums that read like a portfolio, not a folder dump. Built for studios that care how their work shows up.",
  },
  {
    icon: ScanFace,
    title: "Face recognition",
    body: "Find everyone in your library — weddings, events, the family album — without sending a single frame to anyone else.",
  },
  {
    icon: Share2,
    title: "Client galleries",
    body: "Per-album sharing links, upload-enabled albums, and password protection — share with clients without giving them an account.",
  },
  {
    icon: Lock,
    title: "Your domain, your data",
    body: "Runs on your hardware or ours. Your client work never lives on a stranger's server unless you decide it does.",
  },
  {
    icon: Cloud,
    title: "S3 or any disk",
    body: "Backed by AWS S3, R2, MinIO, or a plain drive. Bring the storage you already pay for.",
  },
  {
    icon: Sparkles,
    title: "AI photo labels",
    body: "Auto-generated captions and tags make a decade-deep client archive searchable in seconds.",
  },
]

export function Features() {
  return (
    <section id="features" className="bg-surface py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-6 flex items-center gap-4">
            <span className="block h-px w-12 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Built for studios
            </span>
          </div>
          <h2 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tight text-text-primary">
            Everything a studio needs.
            <br />
            <span className="text-brand">Nothing you don&apos;t.</span>
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.5,
                delay: Math.min(i * 0.06, 0.4),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group flex flex-col gap-4 bg-surface-elevated p-8 transition-colors hover:bg-surface-hover"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon className="size-4 text-text-faint transition-colors group-hover:text-brand" />
              </div>
              <h3 className="mt-6 font-heading text-2xl leading-tight tracking-tight text-text-primary">
                {title}
              </h3>
              <p className="text-[14px] font-light leading-[1.75] text-text-secondary">
                {body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
