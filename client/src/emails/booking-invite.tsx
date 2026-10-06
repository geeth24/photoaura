import { Section, Text } from "@react-email/components"
import { Button, DetailRows, Divider, EmailShell, Eyebrow, styles } from "./shell"

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
  const first = (fullName || "there").split(" ")[0]

  return (
    <EmailShell preview={`Your ${(eventType || "booking").toLowerCase()} agreement is ready to review and sign`}>
      <Eyebrow>{`Booking ${bookingNumber}`}</Eyebrow>
      <Text style={styles.heading}>Let&apos;s lock in your date</Text>
      <Text style={styles.subtitle}>
        Hi {first} — thank you for choosing Reactive Shots. Your agreement is ready. Give it a read and sign it online;
        it only takes a minute.
      </Text>

      <DetailRows
        rows={[
          ["Event", eventType],
          ["Date", eventDate],
          ["Package", packageName],
          ["Total", totalDue, true],
        ]}
      />

      <Section>
        <Button href={link}>Review &amp; sign</Button>
      </Section>

      <Divider />

      <Text style={styles.paragraph}>
        Once it&apos;s signed, a <span style={styles.emphasis}>{retainer}</span> retainer (10%) holds your date. You can
        pay by Zelle, cash, or check — your booking page has the details.
      </Text>

      <Text style={styles.hint}>This link signs you in. It&apos;s just for you — please don&apos;t forward it.</Text>
    </EmailShell>
  )
}
