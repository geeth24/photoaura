import { Section, Text } from "@react-email/components"
import { Button, DetailRows, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = {
  fullName?: string
  link: string
  bookingNumber: string
  albumName: string
  finalAmount: string
  zelle: string
  zellePhone?: string
  memo: string
}

export const galleryDeliveredSubject = (albumName: string) => `Your gallery preview is ready — ${albumName}`

// the link opens the proof gallery itself
export default function GalleryDeliveredEmail({
  fullName,
  link,
  bookingNumber,
  albumName,
  finalAmount,
  zelle,
  zellePhone,
  memo,
}: Props) {
  const first = (fullName || "there").split(" ")[0]

  return (
    <EmailShell preview={`Your photos are edited and ready to view — ${albumName}`}>
      <Eyebrow>Gallery preview</Eyebrow>
      <Text style={styles.heading}>{albumName}</Text>
      <Text style={styles.subtitle}>
        Hi {first} — your photos are edited and ready. Have a look, pick your favorites, and let us know about any
        revisions.
      </Text>

      <Section>
        <Button href={link}>View your gallery</Button>
      </Section>

      <Divider />

      <Text style={styles.paragraph}>
        These are watermarked previews. The clean, full-resolution files and downloads unlock as soon as your final
        payment is received.
      </Text>

      <DetailRows
        rows={[
          ["Final payment", finalAmount, true],
          ["Zelle to", zellePhone ? `${zelle} or ${zellePhone}` : zelle],
          ["Memo", memo],
        ]}
      />

      <Text style={styles.paragraph}>
        Cash or check works too — just mention <span style={styles.emphasis}>{bookingNumber}</span>. We&apos;ll email
        you the moment your gallery unlocks.
      </Text>

      <Text style={styles.hint}>This link signs you in. It&apos;s just for you — please don&apos;t forward it.</Text>
    </EmailShell>
  )
}
