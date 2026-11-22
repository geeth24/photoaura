import { Button, EmailShell, Eyebrow, Heading, Hint, Lead, Note, Paragraph, firstName } from "./shell"
import { SIGN_IN_HINT } from "./copy"

type Props = {
  fullName?: string
  link: string
  albumName: string
  revisionNumber: number
  photoCount: number
  note?: string | null
}

export const albumRevisionSubject = (albumName: string, revisionNumber: number) =>
  `Revision ${revisionNumber} of ${albumName} is ready`

export default function AlbumRevisionEmail({ fullName, link, albumName, revisionNumber, photoCount, note }: Props) {
  const photos = `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`

  return (
    <EmailShell
      preview={`${photos} updated in ${albumName}`}
      art="album-revision"
      artAlt="A photo print being retouched with a fine brush"
    >
      <Eyebrow>{`Revision ${revisionNumber}`}</Eyebrow>
      <Heading>{albumName}</Heading>
      <Lead>
        Hi {firstName(fullName)}, {photos} in your gallery {photoCount === 1 ? "has" : "have"} been re-edited. The new
        versions are already in place.
      </Lead>

      {note && <Note label="From your photographer">{note}</Note>}

      <Button href={link}>See what changed</Button>

      <Paragraph>The link opens on just the updated photos. Everything else in your gallery stays as it was.</Paragraph>

      <Hint>{SIGN_IN_HINT}</Hint>
    </EmailShell>
  )
}

AlbumRevisionEmail.PreviewProps = {
  fullName: "Jordan Ellis",
  link: "https://aura.reactiveshots.com/auth/verify?token=preview&next=/albums/ellis-park-wedding",
  albumName: "Ellis & Park Wedding",
  revisionNumber: 2,
  photoCount: 14,
  note: "Softened the window light on the first-dance shots and brought the blue back into the sky on the portraits.",
} satisfies Props
