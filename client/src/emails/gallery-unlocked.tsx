import {
  Button,
  EmailShell,
  Eyebrow,
  Heading,
  Hint,
  Lead,
  Panel,
  PanelItem,
  SecondaryButton,
  Strong,
  firstName,
} from "./shell"
import { GET_THE_APP } from "./copy"

type Props = {
  fullName?: string
  link: string
  albumName: string
}

export const galleryUnlockedSubject = (albumName: string) => `Your full-resolution photos are ready — ${albumName}`

export default function GalleryUnlockedEmail({ fullName, link, albumName }: Props) {
  return (
    <EmailShell
      preview={`${albumName} is unlocked — full resolution, ready to download`}
      art="gallery-unlocked"
      artAlt="An open padlock beside a printed photograph"
    >
      <Eyebrow>Paid in full</Eyebrow>
      <Heading>{albumName}</Heading>
      <Lead>
        Hi {firstName(fullName)}, thank you! Your final payment is in and your gallery is unlocked. The watermarks are
        gone and every photo is full resolution.
      </Lead>

      <Button href={link}>Get your photos</Button>

      <Panel title="Saving your photos">
        <PanelItem label="On a computer">
          Open the gallery and use <Strong>Download all</Strong> for one zip of the originals.
        </PanelItem>
        <PanelItem label="On your phone">
          The PhotoAura app puts every photo into your camera roll in one tap. Sign in with this same email.
        </PanelItem>
        <SecondaryButton href={GET_THE_APP}>Get the app</SecondaryButton>
      </Panel>

      <Hint>It was a joy to photograph this with you. This link signs you in, so please don&apos;t forward it.</Hint>
    </EmailShell>
  )
}

GalleryUnlockedEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/albums/ellis-park-wedding",
  albumName: "Ellis & Park Wedding",
} satisfies Props
