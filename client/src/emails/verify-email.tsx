import { Heading, Section, Text } from "@react-email/components"
import { Button, EmailShell, styles } from "./shell"

type Props = { fullName?: string; link: string }

export const verifyEmailSubject = () => "Confirm this email for Reactive Shots"

export default function VerifyEmail({ fullName, link }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview="Confirm this email address">
      <Section style={styles.section}>
        <Heading style={styles.heading}>Confirm this email</Heading>
        <Text>Hi {first},</Text>
        <Text>
          You added this address to your Reactive Shots account. Click below to
          confirm it. The link expires in 30 minutes.
        </Text>
        <Button href={link}>Confirm email</Button>
        <Text style={styles.hint}>If you didn&apos;t add this email, ignore this message.</Text>
      </Section>
    </EmailShell>
  )
}
