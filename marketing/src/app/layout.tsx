import type { Metadata, Viewport } from "next"
import { DM_Serif_Display, Outfit } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { StructuredData } from "@/components/structured-data"

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
const TAGLINE = "An editorial photo gallery for working photographers"
const DESCRIPTION =
  "Self-hosted or managed photo gallery for photography studios. Client galleries, face recognition, branded shared albums — on your domain, on your terms."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Rad Soft, Inc.", url: "https://radsoftinc.com" }],
  creator: "Rad Soft, Inc.",
  publisher: "Rad Soft, Inc.",
  keywords: [
    "photography gallery",
    "photo gallery software",
    "self-hosted photo gallery",
    "photographer client gallery",
    "studio photo management",
    "face recognition photos",
    "client proofing gallery",
    "open source photo gallery",
    "self-hosted lightroom alternative",
    "AWS S3 photo gallery",
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
  icons: {
    icon: [
      { url: "/logo-color.png", sizes: "any" },
      { url: "/logo-color.png", type: "image/png" },
    ],
    shortcut: "/logo-color.png",
    apple: "/logo-color.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "PhotoAura — Your photos, beautifully managed.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
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
