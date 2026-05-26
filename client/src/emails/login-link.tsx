import { Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = { fullName?: string; link: string }

export const loginLinkSubject = () => "Your Reactive Shots login link"

export default function LoginLinkEmail({ fullName, link }: Props) {
  const first = (fullName || "there").split(" ")[0]
  return (
    <EmailShell preview="Your secure sign-in link">
      <Eyebrow>Sign in</Eyebrow>
      <Text style={styles.heading}>Welcome back, {first}.</Text>
      <Text style={styles.subtitle}>
        Tap below to sign in to your Reactive Shots gallery. The link expires in
        30 minutes and can only be used once.
      </Text>

      <Section>
        <Button href={link}>Sign in</Button>
      </Section>

      <Divider />

      <Text style={styles.hint}>
        Didn&apos;t ask for this link? You can safely ignore this email — no one
        can sign in without clicking it.
      </Text>
    </EmailShell>
  )
}
