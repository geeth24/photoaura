"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import { FolderOpen, LayoutGrid, ScanFace, Users } from "lucide-react"

const tabs = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    title: "The whole studio at a glance.",
    body: "Recent albums, your biggest collections, and who's been in lately — the morning check-in, on one page.",
    src: "/mockups/studio-dashboard.webp",
  },
  {
    key: "albums",
    label: "Albums",
    icon: FolderOpen,
    title: "Every shoot, one shelf.",
    body: "Upload a session and it's sorted, sized, and ready to share. Weddings, families, brand days — each with its own cover.",
    src: "/mockups/studio-albums.webp",
  },
  {
    key: "people",
    label: "People",
    icon: ScanFace,
    title: "Faces, found for you.",
    body: "Everyone in every album, grouped on your own server. Name them once; find them in any shoot after that.",
    src: "/mockups/studio-faces.webp",
  },
  {
    key: "clients",
    label: "Clients",
    icon: Users,
    title: "Clients, and their families.",
    body: "Invite a client to an album and they get a sign-in link by email. Add a partner or parent to the same account.",
    src: "/mockups/studio-users.webp",
  },
]

const ease = [0.22, 1, 0.36, 1] as const

export function StudioShowcase() {
  const [active, setActive] = useState(0)
  const [touched, setTouched] = useState(false)

  // walk the tabs on its own until someone picks one
  useEffect(() => {
    if (touched) return
    const t = setInterval(() => setActive((i) => (i + 1) % tabs.length), 5000)
    return () => clearInterval(t)
  }, [touched])

  const tab = tabs[active]

  return (
    <section id="studio" className="grain relative overflow-hidden border-t border-border-subtle bg-surface py-28 lg:py-36">
      <div className="pointer-events-none absolute -left-40 top-1/2 h-[36rem] w-[36rem] rounded-full bg-brand/10 blur-[170px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease }}
          className="flex flex-wrap items-end justify-between gap-8"
        >
          <div>
            <div className="mb-6 flex items-center gap-4">
              <span className="block h-px w-12 bg-brand" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
                For the studio
              </span>
            </div>
            <h2 className="pb-[0.15em] font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tight text-text-primary">
              Run the studio
              <br />
              <span className="text-brand">from one screen.</span>
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Studio screens"
            className="-mx-6 flex w-[calc(100%+3rem)] gap-px overflow-x-auto border-y border-border-subtle bg-border-subtle px-6 sm:mx-0 sm:w-auto sm:border sm:px-0"
          >
            {tabs.map((t, i) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={i === active}
                onClick={() => {
                  setTouched(true)
                  setActive(i)
                }}
                className={`relative flex h-11 shrink-0 cursor-pointer items-center gap-2 px-5 text-[11px] font-medium uppercase tracking-[0.2em] transition-colors ${
                  i === active
                    ? "bg-surface-elevated text-text-primary"
                    : "bg-surface text-text-muted hover:text-text-primary"
                }`}
              >
                <t.icon className="size-3.5" />
                {t.label}
                {i === active && (
                  <motion.span layoutId="studio-tab" className="absolute inset-x-0 bottom-0 h-px bg-brand" />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1fr_2.2fr]">
          <div className="min-h-40 lg:order-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease }}
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
                  {String(active + 1).padStart(2, "0")} / {String(tabs.length).padStart(2, "0")}
                </span>
                <h3 className="mt-4 font-heading text-3xl leading-tight tracking-tight text-text-primary lg:text-4xl">
                  {tab.title}
                </h3>
                <p className="mt-4 max-w-sm text-[14px] font-light leading-[1.75] text-text-secondary">
                  {tab.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="relative aspect-[2274/1632]"
          >
            {/* every screen stays mounted so switching never waits on a download */}
            {tabs.map((t, i) => (
              <Image
                key={t.key}
                src={t.src}
                alt={`PhotoAura studio — ${t.label.toLowerCase()} on a MacBook`}
                fill
                sizes="(max-width: 1024px) 100vw, 850px"
                className={`object-contain transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-0"}`}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
