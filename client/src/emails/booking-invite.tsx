import { Button, DetailRows, EmailShell, Eyebrow, Heading, Hint, Lead, Paragraph, Strong, firstName } from "./shell"
import { SIGN_IN_HINT } from "./copy"

// money and dates arrive preformatted from the server ("$675.00", "Saturday, November 14, 2026")
type Props = {
  fullName?: string
  link: string
  bookingNumber: string
  eventType: string
  eventDate: string
  packageName: string
  totalDue: string
  retainer: string
}

export const bookingInviteSubject = () => "Your booking with Reactive Shots Studios: review and sign"

export default function BookingInviteEmail({
  fullName,
  link,
  bookingNumber,
  eventType,
  eventDate,
  packageName,
  totalDue,
  retainer,
}: Props) {
  return (
    <EmailShell
      preview={`Your ${(eventType || "booking").toLowerCase()} agreement is ready to review and sign`}
      art="booking-invite"
      artAlt="A calendar page with one date circled beside a camera"
    >
      <Eyebrow>{`Booking ${bookingNumber}`}</Eyebrow>
      <Heading>Let&apos;s lock in your date</Heading>
      <Lead>
        Hi {firstName(fullName)}, thank you for choosing Reactive Shots. Your agreement is ready. Give it a read and
        sign it online; it only takes a minute.
      </Lead>

      <DetailRows
        rows={[
          ["Event", eventType],
          ["Date", eventDate],
          ["Package", packageName],
          ["Total", totalDue, true],
        ]}
      />

      <Button href={link}>Review &amp; sign</Button>

      <Paragraph>
        Once it&apos;s signed, a <Strong>{retainer}</Strong> retainer (10%) holds your date. You can pay by Zelle, cash
        or check. Your booking page has the details.
      </Paragraph>

      <Hint>{SIGN_IN_HINT}</Hint>
    </EmailShell>
  )
}

BookingInviteEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/bookings/RS-1042",
  bookingNumber: "RS-1042",
  eventType: "Wedding",
  eventDate: "Saturday, March 13, 2027",
  packageName: "Photo + Video",
  totalDue: "$2,400.00",
  retainer: "$240.00",
} satisfies Props
