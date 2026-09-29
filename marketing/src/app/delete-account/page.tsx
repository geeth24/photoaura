import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "How to delete your PhotoAura account and data, what gets removed, and what your photographer keeps.",
  alternates: { canonical: "/delete-account" },
}

const EMAIL = "hello@reactiveshots.com"
const REQUEST = `mailto:${EMAIL}?subject=${encodeURIComponent("Delete my PhotoAura account")}&body=${encodeURIComponent(
  "Please delete my PhotoAura account.\n\nEmail on the account: \nStudio (e.g. Reactive Shots): \n",
)}`

function Heading({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-brand/70">{n}</span>
      <h2 className="font-heading text-2xl leading-tight tracking-tight text-text-primary">{children}</h2>
    </div>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] font-light leading-[1.85] text-text-secondary">{children}</p>
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15px] font-light leading-[1.8] text-text-secondary">
          <span className="mt-[0.8em] block h-px w-3 shrink-0 bg-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

const steps = [
  "Open the PhotoAura app and sign in.",
  "Go to the Profile tab.",
  "Scroll to Danger zone and tap Delete my account.",
  "Confirm. You're signed out and the account is deleted straight away.",
]

export default function DeleteAccountPage() {
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
        <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">Account</span>
      </div>

      <h1 className="mt-3 font-heading text-[clamp(2.5rem,6vw,4rem)] leading-[0.95] tracking-tight text-text-primary">
        Delete your account
      </h1>
      <p className="mt-5 max-w-xl text-[16px] font-light leading-[1.8] text-text-secondary">
        You can delete your PhotoAura account and the data tied to it at any time, from the app or by asking us.
      </p>

      <div className="mt-14 space-y-12">
        <section>
          <Heading n="01">In the app</Heading>
          <ol className="grid gap-px border border-border-subtle bg-border-subtle">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-5 bg-surface-elevated px-6 py-5">
                <span className="font-heading text-2xl leading-none text-brand">{i + 1}</span>
                <span className="pt-0.5 text-[15px] font-light leading-[1.7] text-text-secondary">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <Heading n="02">By email</Heading>
          <div className="space-y-6">
            <P>
              Can&rsquo;t sign in, or use PhotoAura on the web? Email us from the address on your account and
              we&rsquo;ll delete it within 30 days. We may ask you to confirm it&rsquo;s you before we do.
            </P>
            <Link
              href={REQUEST}
              className="inline-flex h-12 items-center gap-2 bg-brand px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface transition-all hover:bg-text-primary hover:shadow-[0_0_50px_rgba(0,166,251,0.3)]"
            >
              <Mail className="size-4" />
              Request deletion
            </Link>
            <p className="text-[13px] font-light text-text-muted">{EMAIL}</p>
          </div>
        </section>

        <section>
          <Heading n="03">What gets deleted</Heading>
          <List
            items={[
              "Your email addresses and sign-in links, so the account can't be signed into again.",
              "Your name and username, replaced with an anonymous placeholder.",
              "Your access to every gallery shared with you.",
              "Your favourites.",
            ]}
          />
        </section>

        <section>
          <Heading n="04">What&rsquo;s kept</Heading>
          <div className="space-y-4">
            <P>
              Photos, videos and files your photographer delivered belong to their studio, so they stay in the
              studio&rsquo;s galleries. That includes face grouping for those photos. To have those removed, ask your
              photographer, or email us and we&rsquo;ll pass the request on.
            </P>
            <P>
              Server logs, such as IP addresses and request times, are kept only as long as needed for security
              and troubleshooting, then deleted.
            </P>
          </div>
        </section>

        <section className="border-t border-border-subtle pt-10">
          <P>
            More detail is in our{" "}
            <Link
              href="/policy"
              className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:text-brand"
            >
              privacy policy
            </Link>
            .
          </P>
        </section>
      </div>
    </article>
  )
}
