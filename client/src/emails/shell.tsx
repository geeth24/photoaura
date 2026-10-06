import type { ReactNode } from "react"
import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"

// shared editorial shell so every Reactive Shots email matches the brand
export function EmailShell({
  preview,
  children,
}: {
  preview: string
  children: ReactNode
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* logo + brand */}
          <Section style={header}>
            <Img
              src="https://aura.reactiveshots.com/email/rs-logo.png"
              width="44"
              height="44"
              alt="Reactive Shots"
              style={{ display: "inline-block" }}
            />
            <Text style={brandText}>Reactive Shots</Text>
          </Section>

          {/* dark content card */}
          <Section style={card}>{children}</Section>

          {/* footer with social links */}
          <Section style={footer}>
            <Text style={footerText}>Reactive Shots · Dallas, TX</Text>
            <Text style={footerText}>
              <Link href="https://reactiveshots.com" style={footerLink}>
                Website
              </Link>
              {" · "}
              <Link
                href="https://www.instagram.com/reactiveshots/"
                style={footerLink}
              >
                Instagram
              </Link>
              {" · "}
              <Link
                href="https://www.youtube.com/@reactive_shots"
                style={footerLink}
              >
                YouTube
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <Section style={eyebrowWrap}>
      <Text style={eyebrowText}>{children}</Text>
    </Section>
  )
}

export function Button({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} style={button}>
      {children}
    </Link>
  )
}

export function Divider() {
  return <Hr style={divider} />
}

// label/value rows in a quiet bordered box — booking facts, receipts, payment details
export function DetailRows({
  rows,
}: {
  rows: [label: string, value: string, strong?: boolean][]
}) {
  return (
    <Section style={detailBox}>
      {rows.map(([label, value, strong], i) => (
        <Row key={label} style={i ? detailRowBorder : undefined}>
          <Column style={detailLabel}>{label}</Column>
          <Column style={strong ? detailValueStrong : detailValue}>{value}</Column>
        </Row>
      ))}
    </Section>
  )
}

// reusable surface styles for individual templates
export const styles = {
  heading: {
    color: "#edf6fc",
    fontSize: "26px",
    fontWeight: 600 as const,
    margin: "0 0 6px",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  subtitle: {
    color: "rgba(237, 246, 252, 0.5)",
    fontSize: "14px",
    margin: "0 0 24px",
  } as React.CSSProperties,
  paragraph: {
    color: "#edf6fc",
    fontSize: "15px",
    lineHeight: 1.7,
    margin: "0 0 16px",
  } as React.CSSProperties,
  hint: {
    color: "rgba(237, 246, 252, 0.4)",
    fontSize: "12px",
    lineHeight: 1.6,
    margin: "16px 0 0",
  } as React.CSSProperties,
  emphasis: {
    color: "#edf6fc",
  } as React.CSSProperties,
}

const body: React.CSSProperties = {
  backgroundColor: "#030d14",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
}

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 20px",
}

const header: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: "28px",
}

const brandText: React.CSSProperties = {
  color: "#00a6fb",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.3em",
  textTransform: "uppercase",
  margin: "10px 0 0",
}

const card: React.CSSProperties = {
  backgroundColor: "#071e2e",
  border: "1px solid rgba(237, 246, 252, 0.06)",
  padding: "36px 32px",
}

const eyebrowWrap: React.CSSProperties = {
  marginBottom: "16px",
}

const eyebrowText: React.CSSProperties = {
  color: "#00a6fb",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.35em",
  textTransform: "uppercase",
  margin: 0,
}

const divider: React.CSSProperties = {
  borderColor: "rgba(237, 246, 252, 0.06)",
  margin: "24px 0",
}

const button: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#00a6fb",
  color: "#030d14",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  textDecoration: "none",
  padding: "14px 28px",
  marginTop: "8px",
}

const detailBox: React.CSSProperties = {
  border: "1px solid rgba(237, 246, 252, 0.08)",
  padding: "4px 16px",
  margin: "0 0 24px",
}

const detailRowBorder: React.CSSProperties = {
  borderTop: "1px solid rgba(237, 246, 252, 0.06)",
}

const detailLabel: React.CSSProperties = {
  color: "rgba(237, 246, 252, 0.4)",
  fontSize: "10px",
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  padding: "12px 12px 12px 0",
  width: "38%",
  verticalAlign: "top",
}

const detailValue: React.CSSProperties = {
  color: "#edf6fc",
  fontSize: "14px",
  lineHeight: 1.5,
  padding: "10px 0",
  verticalAlign: "top",
}

const detailValueStrong: React.CSSProperties = {
  ...detailValue,
  color: "#00a6fb",
  fontSize: "16px",
  fontWeight: 600,
}

const footer: React.CSSProperties = {
  textAlign: "center",
  paddingTop: "28px",
}

const footerText: React.CSSProperties = {
  color: "rgba(237, 246, 252, 0.2)",
  fontSize: "12px",
  margin: "4px 0",
}

const footerLink: React.CSSProperties = {
  color: "rgba(237, 246, 252, 0.35)",
  textDecoration: "none",
}
