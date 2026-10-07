import { Section, Text } from "@react-email/components"
import { Button, DetailRows, Divider, EmailShell, Eyebrow, styles } from "./shell"

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
  const first = (fullName || "there").split(" ")[0]

  return (
    <EmailShell preview={`Signed. Send the ${retainer} retainer to hold ${eventDate}.`}>
      <Eyebrow>Agreement signed</Eyebrow>
      <Text style={styles.heading}>One step left</Text>
      <Text style={styles.subtitle}>
        Hi {first} — your agreement for {eventDate} is signed. A copy is attached to this email. Your date is held as
        soon as the retainer arrives.
      </Text>

      <DetailRows
        rows={[
          ["Retainer due", retainer, true],
          ["Zelle to", zellePhone ? `${zelle} or ${zellePhone}` : zelle],
          ["Memo", memo],
        ]}
      />

      <Text style={styles.paragraph}>
        Zelle is quickest. Cash or check is fine too — just mention <span style={styles.emphasis}>{bookingNumber}</span>
        .
      </Text>

      <Section>
        <Button href={link}>View your booking</Button>
      </Section>

      <Divider />

      <Text style={styles.paragraph}>
        You&apos;ll get a receipt by email each time a payment is marked received, and your booking page always shows
        what&apos;s next.
      </Text>

      <Text style={styles.hint}>This link signs you in. It&apos;s just for you — please don&apos;t forward it.</Text>
    </EmailShell>
  )
}
