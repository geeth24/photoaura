import { Button, DetailRows, EmailShell, Eyebrow, Heading, Hint, Lead, Paragraph, Strong, firstName } from "./shell"

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
  return (
    <EmailShell
      preview={`We received your ${label.toLowerCase()} of ${amount}. Thank you!`}
      art="payment-received"
      artAlt="A paper receipt with a checkmark stamp beside a few coins"
    >
      <Eyebrow>{`Receipt · ${bookingNumber}`}</Eyebrow>
      <Heading>{amount} received</Heading>
      <Lead>
        Hi {firstName(fullName)}, thank you! Here&apos;s your receipt for the {label.toLowerCase()}.
      </Lead>

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
        <Paragraph>
          <Strong>Next up:</Strong> {nextLabel}, {nextAmount}. Your booking page shows when it&apos;s due and how to
          pay.
        </Paragraph>
      ) : (
        <Paragraph>
          <Strong>That&apos;s everything.</Strong> You&apos;re paid in full.
        </Paragraph>
      )}

      <Button href={link}>View your booking</Button>

      <Hint>Keep this email for your records. The link signs you in, so please don&apos;t forward it.</Hint>
    </EmailShell>
  )
}

PaymentReceivedEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/bookings/RS-1042",
  bookingNumber: "RS-1042",
  label: "Event-day payment",
  amount: "$960.00",
  method: "Zelle",
  paidTotal: "$1,200.00",
  balance: "$1,200.00",
  nextLabel: "Final payment",
  nextAmount: "$1,200.00",
} satisfies Props
