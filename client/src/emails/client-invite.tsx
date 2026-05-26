import { Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = { fullName?: string; link: string; albumName: string }

export const clientInviteSubject = (albumName: string) =>
  `Your gallery is ready — ${albumName}`

export default function ClientInviteEmail({ fullName, link, albumName }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview={`Your gallery ${albumName} is ready to view`}>
      <Eyebrow>Your gallery is ready</Eyebrow>
      <Text style={styles.heading}>{albumName}</Text>
      <Text style={styles.subtitle}>
        Hi {first} — your photos are ready to view and download. One click
        below, no password needed.
      </Text>

      <Section>
        <Button href={link}>View your gallery</Button>
      </Section>

      <Divider />

      <Text style={styles.paragraph}>
        Inside you can browse the full shoot, filter to just photos of you, and
        download originals.
      </Text>
      <Text style={styles.hint}>
        This link signs you in. It&apos;s just for you — please don&apos;t
        forward it.
      </Text>
    </EmailShell>
  )
}
