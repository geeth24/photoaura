import { Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = { fullName?: string; link: string; albumName: string }

export const newVideoSubject = (albumName: string) =>
  `A new video is ready — ${albumName}`

export default function NewVideoEmail({ fullName, link, albumName }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview={`A new video is ready in ${albumName}`}>
      <Eyebrow>New video</Eyebrow>
      <Text style={styles.heading}>{albumName}</Text>
      <Text style={styles.subtitle}>
        Hi {first} — a new video has been added to your gallery. Tap below to
        watch, no password needed.
      </Text>

      <Section>
        <Button href={link}>Watch your video</Button>
      </Section>

      <Divider />

      <Text style={styles.hint}>
        This link signs you in. It&apos;s just for you — please don&apos;t
        forward it.
      </Text>
    </EmailShell>
  )
}
