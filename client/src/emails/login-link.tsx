import { Heading, Section, Text } from "@react-email/components"
import { Button, EmailShell, styles } from "./shell"

type Props = { fullName?: string; link: string }

export const loginLinkSubject = () => "Your Reactive Shots login link"

export default function LoginLinkEmail({ fullName, link }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview="Your secure sign-in link" eyebrow="Reactive Shots">
      <Section style={styles.section}>
        <Heading style={styles.heading}>Sign in</Heading>
        <Text>Hi {first},</Text>
        <Text>
          Here&apos;s your secure link to sign in to your gallery. It expires in 30 minutes.
        </Text>
        <Button href={link}>Sign in</Button>
        <Text style={styles.hint}>If you didn&apos;t request this, you can ignore it.</Text>
      </Section>
    </EmailShell>
  )
}
