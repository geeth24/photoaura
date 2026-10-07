import { Section, Text } from "@react-email/components"
import { Button, DetailRows, Divider, EmailShell, Eyebrow, styles } from "./shell"

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
  const first = (fullName || "there").split(" ")[0]

  return (
    <EmailShell preview="Your agreement has been updated. Review the new version and sign when you're ready.">
      <Eyebrow>{`Booking ${bookingNumber}`}</Eyebrow>
      <Text style={styles.heading}>Your agreement is updated</Text>
      <Text style={styles.subtitle}>
        Hi {first} — we&apos;ve updated your agreement. Please give the new version a read and sign it when you&apos;re
        ready.
      </Text>

      {note && <Text style={styles.paragraph}>{note}</Text>}

      <DetailRows
        rows={[
          ["Event", eventType],
          ["Date", eventDate],
          ["Total", totalDue, true],
        ]}
      />

      <Section>
        <Button href={link}>Review &amp; sign</Button>
      </Section>

      <Divider />

      <Text style={styles.hint}>
        The earlier version can&apos;t be signed anymore. This link signs you in — please don&apos;t forward it.
      </Text>
    </EmailShell>
  )
}
