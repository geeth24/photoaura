import { NextResponse } from "next/server"
import { render } from "@react-email/render"
import LoginLinkEmail, { loginLinkSubject } from "@/emails/login-link"
import ClientInviteEmail, { clientInviteSubject } from "@/emails/client-invite"
import VerifyEmail, { verifyEmailSubject } from "@/emails/verify-email"
import NewDownloadEmail, { newDownloadSubject } from "@/emails/new-download"
import NewVideoEmail, { newVideoSubject } from "@/emails/new-video"

// templates registered for the backend to render. add new ones here.
const templates = {
  "login-link": {
    component: LoginLinkEmail,
    subject: () => loginLinkSubject(),
  },
  "client-invite": {
    component: ClientInviteEmail,
    subject: (p: { albumName: string }) => clientInviteSubject(p.albumName),
  },
  "verify-email": {
    component: VerifyEmail,
    subject: () => verifyEmailSubject(),
  },
  "new-download": {
    component: NewDownloadEmail,
    subject: (p: { albumName: string }) => newDownloadSubject(p.albumName),
  },
  "new-video": {
    component: NewVideoEmail,
    subject: (p: { albumName: string }) => newVideoSubject(p.albumName),
  },
} as const

type TemplateName = keyof typeof templates

export async function POST(req: Request) {
  // shared secret — keeps the endpoint from being used as a render-spam target
  const expected = process.env.EMAIL_RENDER_SECRET
  const got = req.headers.get("x-email-secret")
  if (!expected || got !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { template?: string; props?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const name = body.template as TemplateName | undefined
  if (!name || !(name in templates)) {
    return NextResponse.json({ error: `unknown template "${name}"` }, { status: 400 })
  }

  const t = templates[name]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = t.component as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = (body.props as any) || {}

  const html = await render(<Component {...props} />)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subject = (t.subject as any)(props)
  return NextResponse.json({ subject, html })
}
