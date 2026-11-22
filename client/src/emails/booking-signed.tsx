import { Button, DetailRows, EmailShell, Eyebrow, Heading, Hint, Lead, Paragraph, Strong, firstName } from "./shell"
import { SIGN_IN_HINT } from "./copy"

type Props = {
  fullName?: string
  link: string
  bookingNumber: string
  eventDate: string
  retainer: string
  zelle: string
  zellePhone?: string
  memo: string
}

export const bookingSignedSubject = (bookingNumber: string) => `Your agreement is signed — ${bookingNumber}`

// the signed PDF rides along as an attachment
export default function BookingSignedEmail({ fullName, link, bookingNumber, eventDate, retainer, zelle, zellePhone, memo }: Props) {
  return (
    <EmailShell
      preview={`Signed. Send the ${retainer} retainer to hold ${eventDate}.`}
      art="booking-signed"
      artAlt="A signed agreement with a fountain pen across it"
    >
      <Eyebrow>Agreement signed</Eyebrow>
      <Heading>One step left</Heading>
      <Lead>
        Hi {firstName(fullName)}, your agreement for {eventDate} is signed and a copy is attached to this email. Your
        date is held as soon as the retainer arrives.
      </Lead>

      <DetailRows
        rows={[
          ["Retainer due", retainer, true],
          ["Zelle to", zellePhone ? `${zelle} or ${zellePhone}` : zelle],
          ["Memo", memo],
        ]}
      />

      <Paragraph>
        Zelle is quickest. Cash or check is fine too, just mention <Strong>{bookingNumber}</Strong>.
      </Paragraph>

      <Button href={link}>View your booking</Button>

      <Paragraph>
        You&apos;ll get a receipt by email each time a payment is marked received, and your booking page always shows
        what&apos;s next.
      </Paragraph>

      <Hint>{SIGN_IN_HINT}</Hint>
    </EmailShell>
  )
}

BookingSignedEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/bookings/RS-1042",
  bookingNumber: "RS-1042",
  eventDate: "Saturday, March 13, 2027",
  retainer: "$240.00",
  zelle: "zelle@reactiveshots.com",
  zellePhone: "(972) 829-5173",
  memo: "RS-1042 retainer",
} satisfies Props
