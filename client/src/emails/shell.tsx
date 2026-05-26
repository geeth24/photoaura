import type { ReactNode } from "react"
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

// shared editorial-style shell so every email matches the brand
export function EmailShell({
  preview,
  eyebrow = "Reactive Shots",
  children,
}: {
  preview: string
  eyebrow?: string
  children: ReactNode
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrowText}>{eyebrow}</Text>
          </Section>
          {children}
          <Section style={footer}>
            <Text style={footerText}>Reactive Shots · Dallas–Fort Worth</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function Button({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} style={button}>
      {children}
    </a>
  )
}

// styles — kept simple + email-safe
const body: React.CSSProperties = {
  margin: 0,
  padding: "40px 0",
  backgroundColor: "#0a0e14",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}

const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
  backgroundColor: "#0f141c",
  border: "1px solid #1c2430",
}

const header: React.CSSProperties = {
  padding: "28px 32px 0",
}

const eyebrowText: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  letterSpacing: "3px",
  textTransform: "uppercase",
  color: "#00a6fb",
  fontWeight: 600,
}

const footer: React.CSSProperties = {
  padding: "16px 32px 24px",
  marginTop: "16px",
}

const footerText: React.CSSProperties = {
  margin: 0,
  color: "#5b6675",
  fontSize: "11px",
  textAlign: "center",
}

const button: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#00a6fb",
  color: "#0a0e14",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: "12px",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  padding: "14px 28px",
  margin: "8px 0",
}

// shared inner-section styles for templates to reuse
export const styles = {
  section: { padding: "8px 32px 32px", color: "#aab3bf", fontSize: "15px", lineHeight: 1.7 } as React.CSSProperties,
  heading: { margin: "16px 0 0", fontSize: "24px", color: "#f4f6f8", fontWeight: 600 } as React.CSSProperties,
  hint: { fontSize: "12px", color: "#5b6675" } as React.CSSProperties,
  strong: { color: "#f4f6f8" } as React.CSSProperties,
}
