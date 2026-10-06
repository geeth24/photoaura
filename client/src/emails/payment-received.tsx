import { Section, Text } from "@react-email/components"
import { Button, DetailRows, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = {
  fullName?: string
  link: string
  bookingNumber: string
  label: string
  amount: string
  method: string
  paidTotal: string
  balance: string
  nextLabel?: string | null
  nextAmount?: string | null
}

export const paymentReceivedSubject = (amount: string, bookingNumber: string) =>
  `Payment received: ${amount} for ${bookingNumber}`

export default function PaymentReceivedEmail({
  fullName,
  link,
  bookingNumber,
  label,
  amount,
  method,
  paidTotal,
  balance,
  nextLabel,
  nextAmount,
}: Props) {
  const first = (fullName || "there").split(" ")[0]

  return (
    <EmailShell preview={`We received your ${label.toLowerCase()} of ${amount}. Thank you!`}>
      <Eyebrow>{`Receipt · ${bookingNumber}`}</Eyebrow>
      <Text style={styles.heading}>{amount} received</Text>
      <Text style={styles.subtitle}>
        Hi {first} — thank you! Here&apos;s your receipt for the {label.toLowerCase()}.
      </Text>

      <DetailRows
        rows={[
          ["Payment", label],
          ["Amount", amount],
          ["Paid by", method],
          ["Paid so far", paidTotal],
          ["Balance", balance, true],
        ]}
      />

      {nextLabel && nextAmount ? (
        <Text style={styles.paragraph}>
          <span style={styles.emphasis}>Next up:</span> {nextLabel}, {nextAmount}. Your booking page shows when
          it&apos;s due and how to pay.
        </Text>
      ) : (
        <Text style={styles.paragraph}>
          <span style={styles.emphasis}>That&apos;s everything.</span> You&apos;re paid in full.
        </Text>
      )}

      <Section>
        <Button href={link}>View your booking</Button>
      </Section>

      <Divider />

      <Text style={styles.hint}>
        Keep this email for your records. The link signs you in — please don&apos;t forward it.
      </Text>
    </EmailShell>
  )
}
