import {
  Button,
  EmailShell,
  Eyebrow,
  Heading,
  Hint,
  InlineLink,
  Lead,
  Panel,
  PanelItem,
  SecondaryButton,
  Stats,
  Strong,
  firstName,
} from "./shell"
import { GET_THE_APP, SIGN_IN_HINT } from "./copy"

type Props = {
  fullName?: string
  link: string
  albumName: string
  albumSlug?: string
  photoCount?: number
  videoCount?: number
}

export const clientInviteSubject = (albumName: string) => `Your gallery is ready — ${albumName}`

export default function ClientInviteEmail({ fullName, link, albumName, photoCount, videoCount }: Props) {
  const stats: [number, string][] = []
  if (typeof photoCount === "number") stats.push([photoCount, photoCount === 1 ? "Photo" : "Photos"])
  if ((videoCount ?? 0) > 0) stats.push([videoCount ?? 0, videoCount === 1 ? "Video" : "Videos"])
  // the sign-in link lands on the album; #save jumps to the save-to-phone step
  const saveLink = link.includes("next=") ? `${link}%23save` : link

  return (
    <EmailShell
      preview={`Your gallery ${albumName} is ready to view`}
      art="gallery-ready"
      artAlt="Three printed photographs fanned out"
    >
      <Eyebrow>Your gallery is ready</Eyebrow>
      <Heading>{albumName}</Heading>
      <Lead>
        Hi {firstName(fullName)}, your photos are ready. One tap below signs you in, no password needed.
      </Lead>

      {stats.length > 0 && <Stats items={stats} />}

      <Button href={link}>View your gallery</Button>

      <Panel title="Saving your photos">
        <PanelItem label="On your phone">
          The PhotoAura app puts every photo into your camera roll in one tap, full quality, and shows new galleries as
          they land. Sign in with this same email.
        </PanelItem>
        <SecondaryButton href={GET_THE_APP}>Get the app</SecondaryButton>
        <PanelItem label="On a computer">
          Open the gallery and use <Strong>Download all</Strong> for one zip of the originals. In Safari on your phone,{" "}
          <InlineLink href={saveLink}>Save to Photos</InlineLink> works too.
        </PanelItem>
      </Panel>

      <Hint>{SIGN_IN_HINT}</Hint>
    </EmailShell>
  )
}

ClientInviteEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/albums/ellis-park-wedding",
  albumName: "Ellis & Park Wedding",
  albumSlug: "ellis-park-wedding",
  photoCount: 248,
  videoCount: 2,
} satisfies Props
