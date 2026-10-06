import { Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = {
  fullName?: string
  link: string
  albumName: string
}

export const galleryUnlockedSubject = (albumName: string) => `Your full-resolution photos are ready — ${albumName}`

// photoaura.app sends phones to their own store
const GET_THE_APP = "https://photoaura.app/app"

export default function GalleryUnlockedEmail({ fullName, link, albumName }: Props) {
  const first = (fullName || "there").split(" ")[0]

  return (
    <EmailShell preview={`${albumName} is unlocked — full resolution, ready to download`}>
      <Eyebrow>Paid in full</Eyebrow>
      <Text style={styles.heading}>{albumName}</Text>
      <Text style={styles.subtitle}>
        Hi {first} — thank you! Your final payment is in, and your gallery is unlocked. The watermarks are gone and
        every photo is full resolution.
      </Text>

      <Section>
        <Button href={link}>Get your photos</Button>
      </Section>

      <Divider />

      <Text style={styles.paragraph}>
        <span style={styles.emphasis}>On a computer?</span> Open the gallery and use{" "}
        <span style={styles.emphasis}>Download all</span> for one zip of the originals.
      </Text>
      <Text style={styles.paragraph}>
        <span style={styles.emphasis}>On your phone?</span> The PhotoAura app puts every photo into your camera roll in
        one tap. Sign in with this same email.
      </Text>
      <Section>
        <Button href={GET_THE_APP}>Get the app</Button>
      </Section>

      <Text style={styles.hint}>
        It was a joy to photograph this with you. This link signs you in — please don&apos;t forward it.
      </Text>
    </EmailShell>
  )
}
