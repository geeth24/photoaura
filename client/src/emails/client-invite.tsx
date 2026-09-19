import { Column, Link, Row, Section, Text } from "@react-email/components"
import { Button, Divider, EmailShell, Eyebrow, styles } from "./shell"

type Props = {
  fullName?: string
  link: string
  albumName: string
  albumSlug?: string
  photoCount?: number
  videoCount?: number
}

export const clientInviteSubject = (albumName: string) =>
  `Your gallery is ready — ${albumName}`

const APP_STORE = "https://apps.apple.com/app/id6477320360"

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <Column style={stat}>
      <Text style={statNumber}>{n}</Text>
      <Text style={statLabel}>{label}</Text>
    </Column>
  )
}

export default function ClientInviteEmail({
  fullName,
  link,
  albumName,
  photoCount,
  videoCount,
}: Props) {
  const first = (fullName || "there").split(" ")[0]
  const hasCounts = typeof photoCount === "number"
  // the sign-in link lands on the album; #save jumps to the save-to-phone step
  const saveLink = link.includes("next=") ? `${link}%23save` : link

  return (
    <EmailShell preview={`Your gallery ${albumName} is ready to view`}>
      <Eyebrow>Your gallery is ready</Eyebrow>
      <Text style={styles.heading}>{albumName}</Text>
      <Text style={styles.subtitle}>
        Hi {first} — your photos are ready. One tap below signs you in, no
        password needed.
      </Text>

      {hasCounts && (
        <Section style={statsBox}>
          <Row>
            <Stat n={photoCount ?? 0} label={photoCount === 1 ? "photo" : "photos"} />
            {(videoCount ?? 0) > 0 && (
              <Stat n={videoCount ?? 0} label={videoCount === 1 ? "video" : "videos"} />
            )}
          </Row>
        </Section>
      )}

      <Section>
        <Button href={link}>View your gallery</Button>
      </Section>

      <Divider />

      <Text style={styles.paragraph}>
        <span style={styles.emphasis}>On your phone?</span> Open the gallery
        and tap <span style={styles.emphasis}>Save to Photos</span> — every
        picture goes straight into your camera roll, full quality.
      </Text>
      <Text style={styles.paragraph}>
        <span style={styles.emphasis}>On a computer?</span> Use{" "}
        <span style={styles.emphasis}>Download all</span> to get one zip of
        the originals.
      </Text>
      <Text style={styles.paragraph}>
        <Link href={saveLink} style={inlineLink}>
          Save to my phone →
        </Link>
        {"   "}
        <Link href={APP_STORE} style={inlineLink}>
          Get the iPhone app →
        </Link>
      </Text>

      <Text style={styles.hint}>
        This link signs you in. It&apos;s just for you — please don&apos;t
        forward it.
      </Text>
    </EmailShell>
  )
}

const statsBox: React.CSSProperties = {
  border: "1px solid rgba(237, 246, 252, 0.08)",
  padding: "14px 8px",
  margin: "0 0 24px",
}

const stat: React.CSSProperties = {
  textAlign: "center",
}

const statNumber: React.CSSProperties = {
  color: "#edf6fc",
  fontSize: "26px",
  fontWeight: 600,
  lineHeight: 1,
  margin: "0 0 6px",
}

const statLabel: React.CSSProperties = {
  color: "rgba(237, 246, 252, 0.4)",
  fontSize: "10px",
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  margin: 0,
}

const inlineLink: React.CSSProperties = {
  color: "#00a6fb",
  fontSize: "14px",
  textDecoration: "none",
}
