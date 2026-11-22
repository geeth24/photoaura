import { Button, EmailShell, Eyebrow, Heading, Hint, Lead, firstName } from "./shell"
import { SIGN_IN_HINT } from "./copy"

type Props = { fullName?: string; link: string; albumName: string }

export const newDownloadSubject = (albumName: string) => `A new download is ready — ${albumName}`

export default function NewDownloadEmail({ fullName, link, albumName }: Props) {
  return (
    <EmailShell
      preview={`A new download is ready in ${albumName}`}
      art="new-download"
      artAlt="A photo print dropping into an open archive box"
    >
      <Eyebrow>New download</Eyebrow>
      <Heading>{albumName}</Heading>
      <Lead>
        Hi {firstName(fullName)}, a new file is ready for you to download. Tap below to open your gallery, no password
        needed.
      </Lead>
      <Button href={link}>Get your download</Button>
      <Hint>{SIGN_IN_HINT}</Hint>
    </EmailShell>
  )
}

NewDownloadEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/albums/ellis-park-wedding",
  albumName: "Ellis & Park Wedding",
} satisfies Props
