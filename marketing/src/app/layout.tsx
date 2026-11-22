import type { Metadata, Viewport } from "next"
import { DM_Serif_Display, Outfit } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { StructuredData } from "@/components/structured-data"
import { PLATFORM_SCRIPT } from "@/lib/stores"

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
})

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
})

const blackMud = localFont({
  src: "./Blackmud-VGoOx.ttf",
  display: "swap",
  variable: "--font-blackmud-face",
})

const SITE_URL = "https://photoaura.app"
const SITE_NAME = "PhotoAura"
const TAGLINE = "Client galleries that sort themselves"
const DESCRIPTION =
  "Client galleries for photography studios. PhotoAura groups photos by face, picks Highlights, splits the day into Moments, makes reels, and holds watermarked proofs until the final payment. On the web, iPhone and Android."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Rad Soft", url: "https://radsoftinc.com" }],
  creator: "Rad Soft",
  publisher: "Rad Soft",
  keywords: [
    "photographer client gallery",
    "wedding photo gallery",
    "client proofing gallery",
    "watermarked proofs",
    "photo gallery software",
    "face recognition photos",
    "photography booking and payments",
    "photo reels",
    "self-hosted photo gallery",
    "open source photo gallery",
    "PhotoAura",
    "Rad Soft",
  ],
  category: "photography",
  alternates: {
    canonical: SITE_URL,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // icons come from src/app/favicon.ico + icon.png + apple-icon.png (Next file conventions)
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030d14" },
    { media: "(prefers-color-scheme: light)", color: "#f8fbfd" },
  ],
  colorScheme: "dark light",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSerif.variable} ${outfit.variable} ${blackMud.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PLATFORM_SCRIPT }} />
      </head>
      <body className="font-body antialiased min-h-dvh flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
        <StructuredData />
      </body>
    </html>
  )
}
