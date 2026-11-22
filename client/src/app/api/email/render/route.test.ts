import { beforeAll, describe, expect, it } from "vitest"
import { POST } from "./route"
import AlbumRevisionEmail from "@/emails/album-revision"
import BookingInviteEmail from "@/emails/booking-invite"
import BookingRevisedEmail from "@/emails/booking-revised"
import BookingSignedEmail from "@/emails/booking-signed"
import ClientInviteEmail from "@/emails/client-invite"
import GalleryDeliveredEmail from "@/emails/gallery-delivered"
import GalleryUnlockedEmail from "@/emails/gallery-unlocked"
import LoginLinkEmail from "@/emails/login-link"
import NewDownloadEmail from "@/emails/new-download"
import NewVideoEmail from "@/emails/new-video"
import PaymentReceivedEmail from "@/emails/payment-received"
import VerifyEmail from "@/emails/verify-email"

// every template name server/services/email_service.py and the bookings router send
const cases: [name: string, props: { link: string }, subject: string, art: string][] = [
  ["login-link", LoginLinkEmail.PreviewProps, "Your Reactive Shots login link", "login-link"],
  ["verify-email", VerifyEmail.PreviewProps, "Confirm this email for Reactive Shots", "verify-email"],
  ["client-invite", ClientInviteEmail.PreviewProps, "Your gallery is ready — Ellis & Park Wedding", "gallery-ready"],
  ["new-download", NewDownloadEmail.PreviewProps, "A new download is ready — Ellis & Park Wedding", "new-download"],
  ["new-video", NewVideoEmail.PreviewProps, "A new video is ready — Ellis & Park Wedding", "new-video"],
  ["album-revision", AlbumRevisionEmail.PreviewProps, "Revision 2 of Ellis & Park Wedding is ready", "album-revision"],
  [
    "booking-invite",
    BookingInviteEmail.PreviewProps,
    "Your booking with Reactive Shots Studios: review and sign",
    "booking-invite",
  ],
  ["booking-revised", BookingRevisedEmail.PreviewProps, "Your updated agreement — RS-1042", "booking-revised"],
  ["booking-signed", BookingSignedEmail.PreviewProps, "Your agreement is signed — RS-1042", "booking-signed"],
  ["payment-received", PaymentReceivedEmail.PreviewProps, "Payment received: $960.00 for RS-1042", "payment-received"],
  [
    "gallery-delivered",
    GalleryDeliveredEmail.PreviewProps,
    "Your gallery preview is ready — Ellis & Park Wedding",
    "gallery-delivered",
  ],
  [
    "gallery-unlocked",
    GalleryUnlockedEmail.PreviewProps,
    "Your full-resolution photos are ready — Ellis & Park Wedding",
    "gallery-unlocked",
  ],
]

function post(body: unknown, secret = "test-secret") {
  return POST(
    new Request("http://localhost/api/email/render", {
      method: "POST",
      headers: { "content-type": "application/json", "x-email-secret": secret },
      body: JSON.stringify(body),
    }),
  )
}

beforeAll(() => {
  process.env.EMAIL_RENDER_SECRET = "test-secret"
})

describe("email render route", () => {
  it.each(cases)("renders %s", async (template, props, subject, art) => {
    const res = await post({ template, props })
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.subject).toBe(subject)
    // React Email escapes & in attributes
    expect(out.html).toContain(props.link.replaceAll("&", "&amp;"))
    expect(out.html).toContain(`https://cdn.aws.radsoft.tech/photoaura/email/${art}.jpg`)
    expect(out.html).not.toMatch(/<svg|data:image/)
    // plain-text part for spam filters and text-only clients
    expect(out.text).toContain(props.link)
    expect(out.text).not.toMatch(/<[a-z]/)
  })

  it("labels detail rows in the text part", async () => {
    const res = await post({ template: "gallery-delivered", props: GalleryDeliveredEmail.PreviewProps })
    const { text } = await res.json()
    expect(text).toContain("Final payment: $1,200.00")
    expect(text).toContain("Memo: RS-1042 final")
  })

  it("rejects a wrong secret", async () => {
    const res = await post({ template: "login-link", props: {} }, "nope")
    expect(res.status).toBe(401)
  })

  it("rejects an unknown template", async () => {
    const res = await post({ template: "nope", props: {} })
    expect(res.status).toBe(400)
  })
})
