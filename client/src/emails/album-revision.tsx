import { Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

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

export default function AlbumRevisionEmail({
  fullName,
  link,
  albumName,
  revisionNumber,
  photoCount,
  note,
}: Props) {
  const first = (fullName || "there").split(" ")[0]
  const photos = `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`

  return (
    <EmailShell preview={`${photos} updated in ${albumName}`}>
      <Eyebrow>{`Revision ${revisionNumber}`}</Eyebrow>
      <Text style={styles.heading}>{albumName}</Text>
      <Text style={styles.subtitle}>
        Hi {first} — {photos} in your gallery {photoCount === 1 ? "has" : "have"} been
        re-edited. The new versions are already in place.
      </Text>

      {note && (
        <Section style={noteBox}>
          <Text style={noteLabel}>From your photographer</Text>
          <Text style={noteText}>{note}</Text>
        </Section>
      )}

      <Section>
        <Button href={link}>See what changed</Button>
      </Section>

      <Divider />

      <Text style={styles.paragraph}>
        The link opens on just the updated photos. Everything else in your
        gallery stays as it was.
      </Text>

      <Text style={styles.hint}>
        This link signs you in. It&apos;s just for you — please don&apos;t
        forward it.
      </Text>
    </EmailShell>
  )
}

const noteBox: React.CSSProperties = {
  borderLeft: "2px solid #00a6fb",
  padding: "4px 0 4px 16px",
  margin: "0 0 24px",
}

const noteLabel: React.CSSProperties = {
  color: "rgba(237, 246, 252, 0.4)",
  fontSize: "10px",
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  margin: "0 0 6px",
}

const noteText: React.CSSProperties = {
  color: "#edf6fc",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: 0,
}
