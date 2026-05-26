import { Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = { fullName?: string; link: string }

export const verifyEmailSubject = () => "Confirm this email for Reactive Shots"

export default function VerifyEmail({ fullName, link }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview="Confirm this email address">
      <Eyebrow>Confirm your email</Eyebrow>
      <Text style={styles.heading}>One quick step, {first}.</Text>
      <Text style={styles.subtitle}>
        You added this address to your Reactive Shots account. Confirm it below
        so we can sign you in with it later. The link expires in 30 minutes.
      </Text>

      <Section>
        <Button href={link}>Confirm email</Button>
      </Section>

      <Divider />

      <Text style={styles.hint}>
        If you didn&apos;t add this email, ignore this message — it&apos;ll
        expire on its own.
      </Text>
    </EmailShell>
  )
}
