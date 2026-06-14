import { Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = { fullName?: string; link: string; albumName: string }

export const newDownloadSubject = (albumName: string) =>
  `A new download is ready — ${albumName}`

export default function NewDownloadEmail({ fullName, link, albumName }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview={`A new download is ready in ${albumName}`}>
      <Eyebrow>New download</Eyebrow>
      <Text style={styles.heading}>{albumName}</Text>
      <Text style={styles.subtitle}>
        Hi {first} — a new file is ready for you to download. Tap below to open
        your gallery, no password needed.
      </Text>

      <Section>
        <Button href={link}>Get your download</Button>
      </Section>

      <Divider />

      <Text style={styles.hint}>
        This link signs you in. It&apos;s just for you — please don&apos;t
        forward it.
      </Text>
    </EmailShell>
  )
}
