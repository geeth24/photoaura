import { Button, EmailShell, Eyebrow, Heading, Hint, Lead, firstName } from "./shell"

type Props = { fullName?: string; link: string }

export const verifyEmailSubject = () => "Confirm this email for Reactive Shots"

export default function VerifyEmail({ fullName, link }: Props) {
  return (
    <EmailShell
      preview="Confirm this email address"
      art="verify-email"
      artAlt="A sealed envelope with a checkmark wax seal"
    >
      <Eyebrow>Confirm your email</Eyebrow>
      <Heading>One quick step, {firstName(fullName)}.</Heading>
      <Lead>
        You added this address to your Reactive Shots account. Confirm it below so you can sign in with it later. The
        link expires in 30 minutes.
      </Lead>
      <Button href={link}>Confirm email</Button>
      <Hint>If you didn&apos;t add this email, ignore this message. The link expires on its own.</Hint>
    </EmailShell>
  )
}

VerifyEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview",
} satisfies Props
