import { Button, EmailShell, Eyebrow, Heading, Hint, Lead, firstName } from "./shell"
import { SIGN_IN_HINT } from "./copy"

type Props = { fullName?: string; link: string; albumName: string }

export const newVideoSubject = (albumName: string) => `A new video is ready — ${albumName}`

export default function NewVideoEmail({ fullName, link, albumName }: Props) {
  return (
    <EmailShell
      preview={`A new video is ready in ${albumName}`}
      art="new-video"
      artAlt="A film reel unspooling a strip of frames"
    >
      <Eyebrow>New video</Eyebrow>
      <Heading>{albumName}</Heading>
      <Lead>
        Hi {firstName(fullName)}, a new video has been added to your gallery. Tap below to watch, no password needed.
      </Lead>
      <Button href={link}>Watch your video</Button>
      <Hint>{SIGN_IN_HINT}</Hint>
    </EmailShell>
  )
}

NewVideoEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/albums/ellis-park-wedding",
  albumName: "Ellis & Park Wedding",
} satisfies Props
