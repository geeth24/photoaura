import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

import InquiryEmail from "@/emails/inquiry"

const FROM = process.env.CONTACT_FROM ?? "PhotoAura <noreply@mail.reactiveshots.com>"

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

const TO = list(process.env.CONTACT_TO)
const BCC = list(process.env.CONTACT_BCC)

const INTENTS: Record<string, string> = {
  managed: "Managed instance",
  studio: "PhotoAura for my studio",
  selfhost: "Self-host help",
  other: "Something else",
}

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : ""

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

export async function POST(req: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("contact: RESEND_API_KEY is not set")
      return NextResponse.json({ error: "Email is not configured." }, { status: 500 })
    }
    if (!TO.length) {
      console.error("contact: CONTACT_TO is not set")
      return NextResponse.json({ error: "Email is not configured." }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))

    // honeypot — bots fill hidden fields, people don't
    if (clean(body.company, 100)) return NextResponse.json({ success: true })

    const name = clean(body.name, 120)
    const email = clean(body.email, 200)
    const studio = clean(body.studio, 160)
    const intent = clean(body.intent, 40)
    const message = clean(body.message, 5000)

    if (!name) return NextResponse.json({ error: "Please add your name." }, { status: 400 })
    if (!isEmail(email))
      return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 })
    if (!message)
      return NextResponse.json({ error: "Tell us a little about what you need." }, { status: 400 })

    const topic = INTENTS[intent] ?? INTENTS.other
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: TO,
      bcc: BCC.length ? BCC : undefined,
      replyTo: email,
      subject: `PhotoAura — ${topic} · ${name}`,
      react: InquiryEmail({ name, email, studio, topic, message }),
      text: [
        topic,
        "",
        `Name:   ${name}`,
        `Email:  ${email}`,
        ...(studio ? [`Studio: ${studio}`] : []),
        "",
        message,
      ].join("\n"),
    })

    if (error) {
      console.error("contact: resend error", JSON.stringify(error), "to:", TO)
      return NextResponse.json({ error: "Couldn't send that. Try again?" }, { status: 502 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (e) {
    console.error("contact: unhandled", e)
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
