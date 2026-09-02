import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Link,
  Img,
  Preview,
} from "@react-email/components"

type Props = {
  name: string
  email: string
  studio?: string
  topic: string
  message: string
}

export default function InquiryEmail({
  name,
  email,
  studio,
  topic,
  message,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`${topic} — ${name}${studio ? ` · ${studio}` : ""}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://photoaura.app/icon.png"
              width="40"
              height="40"
              alt="PhotoAura"
              style={{ display: "inline-block", borderRadius: "8px" }}
            />
            <Text style={brandText}>PhotoAura</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>{topic}</Text>
            <Heading style={heading}>New inquiry</Heading>
            <Text style={subtitle}>
              Someone reached out from photoaura.app.
            </Text>

            <Hr style={divider} />

            <Section style={detailRow}>
              <Text style={label}>From</Text>
              <Text style={value}>{name}</Text>
            </Section>

            <Section style={detailRow}>
              <Text style={label}>Email</Text>
              <Link href={`mailto:${email}`} style={linkStyle}>
                {email}
              </Link>
            </Section>

            {studio && (
              <Section style={detailRow}>
                <Text style={label}>Studio</Text>
                <Text style={value}>{studio}</Text>
              </Section>
            )}

            <Hr style={divider} />

            <Text style={label}>What they need</Text>
            <Section style={messageBox}>
              <Text style={messageText}>{message}</Text>
            </Section>

            <Hr style={divider} />

            <Section>
              <Link
                href={`mailto:${email}?subject=Re: ${topic}`}
                style={replyButton}
              >
                Reply to {name}
              </Link>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>PhotoAura by Rad Soft · Coppell, TX</Text>
            <Text style={footerText}>
              <Link href="https://photoaura.app" style={footerLink}>
                photoaura.app
              </Link>
              {" · "}
              <Link
                href="https://github.com/geeth24/photoaura"
                style={footerLink}
              >
                GitHub
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: "#030d14",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: "0",
  padding: "0",
}

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 20px",
}

const header = {
  textAlign: "center" as const,
  paddingBottom: "32px",
}

const brandText = {
  color: "#00a6fb",
  fontSize: "18px",
  fontWeight: "600" as const,
  letterSpacing: "0.08em",
  margin: "8px 0 0",
}

const content = {
  backgroundColor: "#071e2e",
  border: "1px solid rgba(237, 246, 252, 0.06)",
  padding: "32px",
}

const eyebrow = {
  color: "#00a6fb",
  fontSize: "10px",
  fontWeight: "600" as const,
  letterSpacing: "0.28em",
  textTransform: "uppercase" as const,
  margin: "0 0 12px",
}

const heading = {
  color: "#edf6fc",
  fontSize: "22px",
  fontWeight: "600" as const,
  margin: "0 0 4px",
}

const subtitle = {
  color: "rgba(237, 246, 252, 0.5)",
  fontSize: "14px",
  margin: "0 0 24px",
}

const divider = {
  borderColor: "rgba(237, 246, 252, 0.06)",
  margin: "24px 0",
}

const detailRow = {
  marginBottom: "16px",
}

const label = {
  color: "rgba(237, 246, 252, 0.35)",
  fontSize: "10px",
  fontWeight: "600" as const,
  letterSpacing: "0.25em",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
}

const value = {
  color: "#edf6fc",
  fontSize: "15px",
  margin: "0",
}

const linkStyle = {
  color: "#00a6fb",
  fontSize: "15px",
  textDecoration: "none",
}

const messageBox = {
  backgroundColor: "#0a2a3f",
  border: "1px solid rgba(237, 246, 252, 0.06)",
  padding: "16px 18px",
  marginTop: "8px",
}

const messageText = {
  color: "#edf6fc",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0",
  whiteSpace: "pre-wrap" as const,
}

const replyButton = {
  backgroundColor: "#00a6fb",
  color: "#030d14",
  display: "inline-block",
  fontSize: "11px",
  fontWeight: "600" as const,
  letterSpacing: "0.2em",
  padding: "14px 28px",
  textDecoration: "none",
  textTransform: "uppercase" as const,
}

const footer = {
  paddingTop: "28px",
  textAlign: "center" as const,
}

const footerText = {
  color: "rgba(237, 246, 252, 0.35)",
  fontSize: "12px",
  margin: "0 0 6px",
}

const footerLink = {
  color: "rgba(237, 246, 252, 0.5)",
  textDecoration: "none",
}
