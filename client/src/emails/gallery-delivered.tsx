import { Button, DetailRows, EmailShell, Eyebrow, Heading, Hint, Lead, Paragraph, Strong, firstName } from "./shell"
import { SIGN_IN_HINT } from "./copy"

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
  return (
    <EmailShell
      preview={`Your photos are edited and ready to view — ${albumName}`}
      art="gallery-delivered"
      artAlt="A contact sheet of small photos with a loupe resting on it"
    >
      <Eyebrow>Gallery preview</Eyebrow>
      <Heading>{albumName}</Heading>
      <Lead>
        Hi {firstName(fullName)}, your photos are edited and ready. Have a look, pick your favorites, and let us know
        about any revisions.
      </Lead>

      <Button href={link}>View your gallery</Button>

      <Paragraph>
        These are watermarked previews. The clean, full-resolution files and downloads unlock as soon as your final
        payment is received.
      </Paragraph>

      <DetailRows
        rows={[
          ["Final payment", finalAmount, true],
          ["Zelle to", zellePhone ? `${zelle} or ${zellePhone}` : zelle],
          ["Memo", memo],
        ]}
      />

      <Paragraph>
        Cash or check works too, just mention <Strong>{bookingNumber}</Strong>. We&apos;ll email you the moment your
        gallery unlocks.
      </Paragraph>

      <Hint>{SIGN_IN_HINT}</Hint>
    </EmailShell>
  )
}

GalleryDeliveredEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/albums/ellis-park-wedding",
  bookingNumber: "RS-1042",
  albumName: "Ellis & Park Wedding",
  finalAmount: "$1,200.00",
  zelle: "zelle@reactiveshots.com",
  zellePhone: "(972) 829-5173",
  memo: "RS-1042 final",
} satisfies Props
