import { Heading, Section, Text } from "@react-email/components"
import { Button, EmailShell, styles } from "./shell"

type Props = { fullName?: string; link: string; albumName: string }

export const clientInviteSubject = (albumName: string) =>
  `Your gallery is ready — ${albumName}`

export default function ClientInviteEmail({ fullName, link, albumName }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview={`Your gallery ${albumName} is ready to view`}>
      <Section style={styles.section}>
        <Heading style={styles.heading}>Your gallery is ready</Heading>
        <Text>Hi {first},</Text>
        <Text>
          Your gallery <span style={styles.strong}>{albumName}</span> is ready to view.
          Click below to open it — no password needed.
        </Text>
        <Button href={link}>View your gallery</Button>
        <Text style={styles.hint}>This link signs you in. It&apos;s just for you.</Text>
      </Section>
    </EmailShell>
  )
}
