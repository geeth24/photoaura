import { Button, DetailRows, EmailShell, Eyebrow, Heading, Hint, Lead, Note, firstName } from "./shell"

type Props = {
  fullName?: string
  link: string
  bookingNumber: string
  eventType: string
  eventDate: string
  totalDue: string
  note?: string | null
}

export const bookingRevisedSubject = (bookingNumber: string) => `Your updated agreement — ${bookingNumber}`

export default function BookingRevisedEmail({ fullName, link, bookingNumber, eventType, eventDate, totalDue, note }: Props) {
  return (
    <EmailShell
      preview="Your agreement has been updated. Review the new version and sign when you're ready."
      art="booking-revised"
      artAlt="Two agreement pages with a pencil making an edit"
    >
      <Eyebrow>{`Booking ${bookingNumber}`}</Eyebrow>
      <Heading>Your agreement is updated</Heading>
      <Lead>
        Hi {firstName(fullName)}, we&apos;ve updated your agreement. Please give the new version a read and sign it
        when you&apos;re ready.
      </Lead>

      {note && <Note label="What changed">{note}</Note>}

      <DetailRows
        rows={[
          ["Event", eventType],
          ["Date", eventDate],
          ["Total", totalDue, true],
        ]}
      />

      <Button href={link}>Review &amp; sign</Button>

      <Hint>
        The earlier version can&apos;t be signed anymore. This link signs you in, so please don&apos;t forward it.
      </Hint>
    </EmailShell>
  )
}

BookingRevisedEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/bookings/RS-1042",
  bookingNumber: "RS-1042",
  eventType: "Wedding",
  eventDate: "Saturday, March 13, 2027",
  totalDue: "$2,640.00",
  note: "Moved the start time to 4 PM and added an hour of portraits, like we talked about.",
} satisfies Props
