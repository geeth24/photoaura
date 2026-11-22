import type { CSSProperties, ReactNode } from "react"
import {
  Body,
  Button as EmailButton,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"

// email clients can't read CSS variables, so these are the reactiveshots.com
// light and dark tokens as solid hex (Outlook drops rgba)
const light = {
  page: "#f5f6f7",
  card: "#ffffff",
  panel: "#eaedf0",
  border: "#d7dee4",
  text: "#111923",
  secondary: "#354451",
  muted: "#4e5d69",
  brand: "#006da4",
  onBrand: "#ffffff",
}

const dark = {
  page: "#080d13",
  card: "#111923",
  panel: "#17212b",
  border: "#25303b",
  text: "#f4f5f5",
  secondary: "#c5cdd3",
  muted: "#a0a9b1",
  brand: "#00a6fb",
  onBrand: "#080d13",
}

// hero illustrations, one per email, served from the Rad Soft CDN
const ART = "https://cdn.aws.radsoft.tech/photoaura/email"
export type Art =
  | "album-revision"
  | "booking-invite"
  | "booking-revised"
  | "booking-signed"
  | "gallery-delivered"
  | "gallery-ready"
  | "gallery-unlocked"
  | "login-link"
  | "new-download"
  | "new-video"
  | "payment-received"
  | "verify-email"

const font =
  'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

// Gmail ignores this block and keeps the inline light styles; Apple Mail,
// iOS Mail and Outlook for Mac pick up the dark overrides
const css = `
@font-face { font-family: "Outfit"; font-style: normal; font-weight: 400 600; src: url(https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) format("woff2"); }
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .rs-page { background-color: ${dark.page} !important; }
  .rs-card { background-color: ${dark.card} !important; border-color: ${dark.border} !important; }
  .rs-panel { background-color: ${dark.panel} !important; }
  .rs-text { color: ${dark.text} !important; }
  .rs-sub { color: ${dark.secondary} !important; }
  .rs-muted { color: ${dark.muted} !important; }
  .rs-brand { color: ${dark.brand} !important; }
  .rs-rule { border-color: ${dark.border} !important; }
  .rs-note { border-color: ${dark.brand} !important; background-color: ${dark.panel} !important; }
  .rs-btn { background-color: ${dark.brand} !important; color: ${dark.onBrand} !important; }
  .rs-btn2 { border-color: ${dark.muted} !important; color: ${dark.text} !important; }
}
[data-ogsb] .rs-page { background-color: ${dark.page} !important; }
[data-ogsb] .rs-card { background-color: ${dark.card} !important; }
[data-ogsb] .rs-panel, [data-ogsb] .rs-note { background-color: ${dark.panel} !important; }
[data-ogsc] .rs-text { color: ${dark.text} !important; }
[data-ogsc] .rs-sub { color: ${dark.secondary} !important; }
[data-ogsc] .rs-muted { color: ${dark.muted} !important; }
[data-ogsc] .rs-brand { color: ${dark.brand} !important; }
@media only screen and (max-width: 620px) {
  .rs-pad { padding: 30px 24px 34px !important; }
  .rs-h1 { font-size: 30px !important; }
}
`

export function EmailShell({
  preview,
  art,
  artAlt,
  children,
}: {
  preview: string
  art: Art
  artAlt: string
  children: ReactNode
}) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body className="rs-page" style={body}>
        {/* Gmail drops <body> styles, so the page color lives on this wrapper too */}
        <Section className="rs-page" style={page}>
          <Container style={container}>
            <Section style={header}>
              <Link href="https://reactiveshots.com" data-skip-in-text="true" style={{ textDecoration: "none" }}>
                <Img
                  src={`${ART}/reactive-shots-wordmark.png`}
                  width="160"
                  height="36"
                  alt="Reactive Shots"
                  style={wordmark}
                />
              </Link>
            </Section>

            <Section className="rs-card" style={card}>
              <Img src={`${ART}/${art}.jpg`} width="600" height="300" alt={artAlt} style={hero} />
              <Section className="rs-pad" style={cardBody}>
                {children}
              </Section>
            </Section>

            <Section style={footer}>
              <Text className="rs-muted" style={footerText}>
                Reactive Shots{"\u00a0\u00a0·\u00a0\u00a0"}Dallas, TX
              </Text>
              <Text className="rs-muted" style={footerText}>
                <Link href="https://reactiveshots.com" className="rs-muted" style={footerLink}>
                  Website
                </Link>
                {"\u00a0\u00a0·\u00a0\u00a0"}
                <Link href="https://www.instagram.com/reactiveshots/" className="rs-muted" style={footerLink}>
                  Instagram
                </Link>
                {"\u00a0\u00a0·\u00a0\u00a0"}
                <Link href="https://www.youtube.com/@reactive_shots" className="rs-muted" style={footerLink}>
                  YouTube
                </Link>
              </Text>
              <Link href="https://radsoftinc.com" className="rs-muted" style={credit}>
                Built by{" "}
                <Img src={`${ART}/rad-soft-mark.png`} width="9" height="10" alt="" style={creditMark} />{" "}
                Rad Soft
              </Link>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  )
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <Text className="rs-brand" style={eyebrow}>
      {children}
    </Text>
  )
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text className="rs-text rs-h1" style={heading}>
      {children}
    </Text>
  )
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <Text className="rs-sub" style={lead}>
      {children}
    </Text>
  )
}

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text className="rs-sub" style={paragraph}>
      {children}
    </Text>
  )
}

export function Strong({ children }: { children: ReactNode }) {
  return (
    <span className="rs-text" style={strong}>
      {children}
    </span>
  )
}

export function Button({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ margin: "4px 0 28px" }}>
      <EmailButton href={href} className="rs-btn" style={button}>
        {children}
      </EmailButton>
    </Section>
  )
}

export function SecondaryButton({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ margin: "-4px 0 20px" }}>
      <EmailButton href={href} className="rs-btn2" style={secondaryButton}>
        {children}
      </EmailButton>
    </Section>
  )
}

// label/value rows — booking facts, receipts, payment details
export function DetailRows({ rows }: { rows: [label: string, value: string, strong?: boolean][] }) {
  return (
    <Section className="rs-rule" style={detailBox}>
      {rows.map(([label, value, isStrong], i) => (
        <Row key={label} className="rs-rule" style={i ? detailRowBorder : undefined}>
          <Column className="rs-muted rs-label" style={detailLabel}>
            {label}
          </Column>
          <Column className={isStrong ? "rs-brand" : "rs-text"} style={isStrong ? detailValueStrong : detailValue}>
            {value}
          </Column>
        </Row>
      ))}
    </Section>
  )
}

// a quoted note from the studio, or what changed
export function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Section className="rs-note" style={note}>
      <Text className="rs-muted" style={noteLabel}>
        {label}
      </Text>
      <Text className="rs-text" style={noteText}>
        {children}
      </Text>
    </Section>
  )
}

// big numbers — what's inside a gallery
export function Stats({ items }: { items: [n: number, label: string][] }) {
  return (
    <Section className="rs-rule" style={statsBox}>
      <Row>
        {items.map(([n, label]) => (
          <Column key={label} className="rs-stat" style={stat}>
            <Text className="rs-text rs-stat-n" style={statNumber}>
              {n}
            </Text>
            <Text className="rs-muted rs-stat-l" style={statLabel}>
              {label}
            </Text>
          </Column>
        ))}
      </Row>
    </Section>
  )
}

// tinted box for the "how to save your photos" tips
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section className="rs-panel" style={panel}>
      <Text className="rs-text" style={panelTitle}>
        {title}
      </Text>
      {children}
    </Section>
  )
}

export function PanelItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Text className="rs-sub" style={panelItem}>
      <span className="rs-text" style={strong}>
        {label}
      </span>
      <br />
      {children}
    </Text>
  )
}

export function InlineLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="rs-brand" style={inlineLink}>
      {children}
    </Link>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <Text className="rs-muted rs-rule" style={hint}>
      {children}
    </Text>
  )
}

export const firstName = (fullName?: string) => (fullName || "there").split(" ")[0]

// html-to-text ships no types; these are the bits the formatters touch
type TextNode = { children: unknown[] }
type TextBuilder = { addInline: (text: string) => void }
type Walk = (nodes: unknown[], builder: TextBuilder) => void

// keeps the plain-text part readable: "Final payment: $1,200.00", "248 Photos"
export const textOptions = {
  formatters: {
    trailingColon: (elem: TextNode, walk: Walk, builder: TextBuilder) => {
      walk(elem.children, builder)
      builder.addInline(": ")
    },
    trailingSpace: (elem: TextNode, walk: Walk, builder: TextBuilder) => {
      walk(elem.children, builder)
      builder.addInline(" ")
    },
  },
  selectors: [
    { selector: "td.rs-label", format: "trailingColon" },
    { selector: "td.rs-stat", format: "block" },
    { selector: "p.rs-stat-n", format: "trailingSpace" },
    { selector: "p.rs-stat-l", format: "inline" },
  ],
}

const body: CSSProperties = {
  backgroundColor: light.page,
  fontFamily: font,
  margin: 0,
  padding: 0,
  WebkitTextSizeAdjust: "100%",
}

const page: CSSProperties = {
  backgroundColor: light.page,
  width: "100%",
}

const container: CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "32px 12px 40px",
}

const header: CSSProperties = {
  padding: "0 4px 22px",
}

const wordmark: CSSProperties = {
  display: "block",
  border: 0,
  color: "#00a6fb",
  fontFamily: font,
  fontSize: "22px",
  fontWeight: 600,
}

const card: CSSProperties = {
  backgroundColor: light.card,
  border: `1px solid ${light.border}`,
}

const hero: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  backgroundColor: "#071e2e",
  color: "#edf6fc",
  fontFamily: font,
  fontSize: "13px",
}

const cardBody: CSSProperties = {
  padding: "40px 44px 44px",
}

const eyebrow: CSSProperties = {
  color: light.brand,
  fontFamily: font,
  fontSize: "13px",
  fontWeight: 500,
  letterSpacing: "0.02em",
  lineHeight: "18px",
  margin: "0 0 12px",
}

const heading: CSSProperties = {
  color: light.text,
  fontFamily: font,
  fontSize: "34px",
  fontWeight: 500,
  lineHeight: 1.12,
  letterSpacing: "-0.035em",
  margin: "0 0 14px",
}

const lead: CSSProperties = {
  color: light.secondary,
  fontFamily: font,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 28px",
}

const paragraph: CSSProperties = {
  color: light.secondary,
  fontFamily: font,
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 20px",
}

const strong: CSSProperties = {
  color: light.text,
  fontWeight: 600,
}

const button: CSSProperties = {
  backgroundColor: light.brand,
  color: light.onBrand,
  fontFamily: font,
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "0.01em",
  textDecoration: "none",
  padding: "16px 28px",
  display: "inline-block",
}

const secondaryButton: CSSProperties = {
  border: `1px solid ${light.muted}`,
  color: light.text,
  fontFamily: font,
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "11px 20px",
  display: "inline-block",
}

const detailBox: CSSProperties = {
  borderTop: `1px solid ${light.border}`,
  borderBottom: `1px solid ${light.border}`,
  margin: "0 0 28px",
}

const detailRowBorder: CSSProperties = {
  borderTop: `1px solid ${light.border}`,
}

const detailLabel: CSSProperties = {
  color: light.muted,
  fontFamily: font,
  fontSize: "14px",
  padding: "14px 16px 14px 0",
  width: "36%",
  verticalAlign: "top",
  lineHeight: "22px",
}

const detailValue: CSSProperties = {
  color: light.text,
  fontFamily: font,
  fontSize: "15px",
  fontWeight: 500,
  lineHeight: "22px",
  padding: "14px 0",
  textAlign: "right",
  verticalAlign: "top",
}

const detailValueStrong: CSSProperties = {
  ...detailValue,
  color: light.brand,
  fontSize: "22px",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  padding: "12px 0",
  lineHeight: "26px",
}

const note: CSSProperties = {
  backgroundColor: light.panel,
  borderLeft: `3px solid ${light.brand}`,
  padding: "16px 20px",
  margin: "0 0 28px",
}

const noteLabel: CSSProperties = {
  color: light.muted,
  fontFamily: font,
  fontSize: "13px",
  fontWeight: 500,
  margin: "0 0 4px",
}

const noteText: CSSProperties = {
  color: light.text,
  fontFamily: font,
  fontSize: "15px",
  lineHeight: 1.6,
  margin: 0,
}

const statsBox: CSSProperties = {
  borderTop: `1px solid ${light.border}`,
  borderBottom: `1px solid ${light.border}`,
  padding: "18px 0",
  margin: "0 0 28px",
}

const stat: CSSProperties = {
  textAlign: "left",
  verticalAlign: "top",
}

const statNumber: CSSProperties = {
  color: light.text,
  fontFamily: font,
  fontSize: "40px",
  fontWeight: 500,
  letterSpacing: "-0.04em",
  lineHeight: 1,
  margin: "0 0 6px",
}

const statLabel: CSSProperties = {
  color: light.muted,
  fontFamily: font,
  fontSize: "14px",
  margin: 0,
}

const panel: CSSProperties = {
  backgroundColor: light.panel,
  padding: "22px 24px 4px",
  margin: "0 0 28px",
}

const panelTitle: CSSProperties = {
  color: light.text,
  fontFamily: font,
  fontSize: "19px",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  lineHeight: 1.25,
  margin: "0 0 14px",
}

const panelItem: CSSProperties = {
  color: light.secondary,
  fontFamily: font,
  fontSize: "14px",
  lineHeight: 1.6,
  margin: "0 0 18px",
}

const inlineLink: CSSProperties = {
  color: light.brand,
  textDecoration: "underline",
}

const hint: CSSProperties = {
  color: light.muted,
  fontFamily: font,
  fontSize: "13px",
  lineHeight: 1.6,
  borderTop: `1px solid ${light.border}`,
  padding: "20px 0 0",
  margin: "8px 0 0",
}

const footer: CSSProperties = {
  textAlign: "center",
  padding: "28px 0 0",
}

const footerText: CSSProperties = {
  color: light.muted,
  fontFamily: font,
  fontSize: "13px",
  lineHeight: 1.6,
  margin: "0 0 4px",
}

const footerLink: CSSProperties = {
  color: light.muted,
  textDecoration: "underline",
}

const credit: CSSProperties = {
  display: "inline-block",
  color: light.muted,
  fontFamily: font,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  textDecoration: "none",
  marginTop: "18px",
}

const creditMark: CSSProperties = {
  display: "inline-block",
  verticalAlign: "-1px",
  border: 0,
}
