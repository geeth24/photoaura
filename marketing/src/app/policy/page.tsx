import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How PhotoAura handles your data — short version: it doesn't.",
}

const sections = [
  {
    heading: "Introduction",
    body: 'Welcome to PhotoAura, an app developed by Rad Soft, Inc. ("we," "our," or "us"). At PhotoAura, we value your privacy and are committed to protecting your personal information. This Privacy Policy outlines our practices regarding the collection, use, and sharing of user data when you use our app. Please read carefully.',
  },
  {
    heading: "Information we collect",
    body: "PhotoAura is designed to let you organize, edit, and share your photos from a single place — privately, on infrastructure you control. It is self-hosted and open-source. As a self-hosted app, PhotoAura does not collect or store any personal information about you on our servers. All your photos and data stay on yours.",
  },
  {
    heading: "How we use your information",
    body: "We don't. We don't collect, retain, or process any of your information.",
  },
  {
    heading: "Data sharing",
    body: "We do not sell, trade, or share your personal information with third parties for marketing or advertising purposes.",
  },
  {
    heading: "Legal compliance",
    body: "PhotoAura complies with all applicable data-protection and privacy laws in the countries where the app is available. We will cooperate with law-enforcement agencies and other governmental organizations when required to do so by law.",
  },
  {
    heading: "Security",
    body: "We take reasonable measures to protect the information collected through the app. However, no data transmission over the internet is completely secure, and we cannot guarantee the absolute security of your data.",
  },
  {
    heading: "Changes to this policy",
    body: 'We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will post the revised policy on our website and update the "Last updated" date.',
  },
]

export default function PolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-20 pb-24 lg:px-10 lg:pt-28">
      <Link
        href="/"
        className="group inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.25em] text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        Home
      </Link>

      <div className="mt-10 flex items-center gap-4">
        <span className="block h-px w-12 bg-brand" />
        <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
          Legal
        </span>
      </div>

      <h1 className="mt-3 font-heading text-[clamp(2.5rem,6vw,4rem)] leading-[0.95] tracking-tight text-text-primary">
        Privacy Policy
      </h1>
      <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-text-faint">
        Last updated · February 2, 2024
      </p>

      <div className="mt-14 space-y-12">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-brand/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-heading text-2xl leading-tight tracking-tight text-text-primary">
                {s.heading}
              </h2>
            </div>
            <p className="text-[15px] font-light leading-[1.85] text-text-secondary">
              {s.body}
            </p>
          </section>
        ))}

        <section className="border-t border-border-subtle pt-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-brand/70">
              {String(sections.length + 1).padStart(2, "0")}
            </span>
            <h2 className="font-heading text-2xl leading-tight tracking-tight text-text-primary">
              Contact us
            </h2>
          </div>
          <p className="text-[15px] font-light leading-[1.85] text-text-secondary">
            If you have any questions, concerns, or requests regarding this
            Privacy Policy or your personal data, reach us at:
          </p>
          <div className="mt-6 space-y-1 text-[14px] font-light text-text-secondary">
            <p>Rad Soft, Inc.</p>
            <p className="text-text-muted">Coppell, TX 75019</p>
            <p>
              <Link
                href="mailto:info@radsoftinc.com"
                className="text-text-primary transition-colors hover:text-brand"
              >
                info@radsoftinc.com
              </Link>
            </p>
          </div>
        </section>
      </div>
    </article>
  )
}
