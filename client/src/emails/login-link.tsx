import { Button, EmailShell, Eyebrow, Heading, Hint, Lead, firstName } from "./shell"

type Props = { fullName?: string; link: string }

export const loginLinkSubject = () => "Your Reactive Shots login link"

export default function LoginLinkEmail({ fullName, link }: Props) {
  return (
    <EmailShell
      preview="Your secure sign-in link"
      art="login-link"
      artAlt="An old key with a camera-aperture handle"
    >
      <Eyebrow>Sign in</Eyebrow>
      <Heading>Welcome back, {firstName(fullName)}.</Heading>
      <Lead>
        Tap below to sign in to your Reactive Shots gallery. The link works once and expires in 30 minutes.
      </Lead>
      <Button href={link}>Sign in</Button>
      <Hint>
        Didn&apos;t ask for this link? You can safely ignore this email. No one can sign in without clicking it.
      </Hint>
    </EmailShell>
  )
}

LoginLinkEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview",
} satisfies Props
