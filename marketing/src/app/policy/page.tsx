import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What PhotoAura collects to deliver your galleries, how it's used, who it's shared with, and how to delete it.",
  alternates: { canonical: "/policy" },
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] font-light leading-[1.85] text-text-secondary">{children}</p>
}

function Items({ items }: { items: [string, ReactNode][] }) {
  return (
    <ul className="space-y-4">
      {items.map(([title, text]) => (
        <li key={title} className="border-l border-border-default pl-5">
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-text-primary">{title}</p>
          <p className="mt-1.5 text-[15px] font-light leading-[1.8] text-text-secondary">{text}</p>
        </li>
      ))}
    </ul>
  )
}

const inline = "text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:text-brand"

const sections: { heading: string; content: ReactNode }[] = [
  {
    heading: "Who we are",
    content: (
      <>
        <P>
          PhotoAura is made by Rad Soft (&ldquo;we&rdquo;, &ldquo;us&rdquo;). Photographers use it to deliver
          galleries, and their clients view those galleries in the PhotoAura iOS, Android and web apps. This
          policy covers those apps and the PhotoAura service we run, including galleries delivered at
          aura.reactiveshots.com.
        </P>
        <P>
          If you connect the app to a different studio&rsquo;s own server (a &ldquo;custom studio&rdquo;), that
          studio runs the server, and its privacy policy covers what it stores.
        </P>
      </>
    ),
  },
  {
    heading: "What we collect",
    content: (
      <Items
        items={[
          [
            "Account details",
            "Your name, username and email addresses. Your photographer creates your account when they share a gallery with you, and you can change your name and username in the app.",
          ],
          [
            "Sign-in",
            "One-time sign-in links sent to your email, which expire after 30 minutes. If your account uses a password, we only store a salted hash of it.",
          ],
          [
            "Your galleries",
            "The photos, videos and files your photographer uploads for you.",
          ],
          [
            "Favourites",
            "The photos you heart, so your photographer can see which ones you picked.",
          ],
          [
            "Face grouping",
            "So you can filter a gallery to one person, our servers detect faces in gallery photos and store a numerical description of each face. It's only used to group photos of the same person within that studio's galleries. It is never used to identify you anywhere else, and never shared or sold.",
          ],
          [
            "Technical data",
            "Our servers log basic request details such as IP address, device type and time, to keep the service secure and fix problems.",
          ],
          [
            "Analytics",
            "The web app uses Vercel Web Analytics, which counts page views without cookies and without identifying you. The iOS and Android apps have no analytics, no ads and no tracking.",
          ],
        ]}
      />
    ),
  },
  {
    heading: "How we use it",
    content: (
      <P>
        Only to run PhotoAura: showing you your galleries, signing you in, sending sign-in and &ldquo;your
        gallery is ready&rdquo; emails, letting your photographer see your favourites, and keeping the service
        secure. We don&rsquo;t show ads, sell your data, or build profiles about you.
      </P>
    ),
  },
  {
    heading: "Who we share it with",
    content: (
      <Items
        items={[
          [
            "Your photographer",
            "The studio that shared a gallery with you can see your account details and favourites.",
          ],
          [
            "Service providers",
            "Companies that run parts of the service for us and may only use the data to do that: Amazon Web Services (photo storage and delivery), Vercel (web app hosting and analytics) and Resend (email delivery).",
          ],
          [
            "When the law requires it",
            "If we're legally required to, for example to answer a valid court order.",
          ],
        ]}
      />
    ),
  },
  {
    heading: "Security",
    content: (
      <P>
        Everything is sent over encrypted connections (HTTPS). A gallery is only visible to the accounts your
        photographer shares it with, and to anyone they send a share link. No system is perfectly secure, but we
        work to protect your data and fix problems quickly.
      </P>
    ),
  },
  {
    heading: "How long we keep it",
    content: (
      <>
        <P>
          We keep your account details while your account is active. When you delete your account, your sign-in
          links, email addresses, gallery access and favourites are removed straight away, and your name and
          username are replaced with an anonymous placeholder.
        </P>
        <P>
          Photos and videos belong to your photographer&rsquo;s studio, so they stay in the studio&rsquo;s
          galleries until the studio removes them. Server logs are kept only as long as needed for security and
          troubleshooting.
        </P>
      </>
    ),
  },
  {
    heading: "Deleting your account",
    content: (
      <P>
        You can delete your account in the app, or ask us to do it. The steps are on the{" "}
        <Link href="/delete-account" className={inline}>
          delete your account
        </Link>{" "}
        page.
      </P>
    ),
  },
  {
    heading: "Your rights",
    content: (
      <P>
        You can ask for a copy of your data, ask us to correct or delete it, or ask a question about it at any
        time. Depending on where you live (for example the EU, UK or California) you may have further rights under
        local law. We reply within 30 days.
      </P>
    ),
  },
  {
    heading: "Children",
    content: (
      <P>
        PhotoAura is for people 16 and over, such as the clients who book a shoot and teens receiving their own
        senior portraits. It isn&rsquo;t made for younger children, though they may appear in photos a
        photographer shares with their parent or guardian. If you think a child under 16 has an account, contact
        us and we&rsquo;ll remove it.
      </P>
    ),
  },
  {
    heading: "Changes to this policy",
    content: (
      <P>
        If we change this policy we&rsquo;ll post the new version here and update the date at the top. For
        significant changes we&rsquo;ll also let you know in the app or by email.
      </P>
    ),
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
        Last updated · September 29, 2026
      </p>

      <div className="mt-14 space-y-12">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-brand/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-heading text-2xl leading-tight tracking-tight text-text-primary">
                {s.heading}
              </h2>
            </div>
            <div className="space-y-4">{s.content}</div>
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
          <P>Questions or requests about this policy or your data:</P>
          <div className="mt-6 space-y-1 text-[14px] font-light text-text-secondary">
            <p>Rad Soft</p>
            <p className="text-text-muted">Coppell, TX 75019</p>
            <p>
              <Link
                href="mailto:hello@reactiveshots.com"
                className="text-text-primary transition-colors hover:text-brand"
              >
                hello@reactiveshots.com
              </Link>
            </p>
          </div>
        </section>
      </div>
    </article>
  )
}
