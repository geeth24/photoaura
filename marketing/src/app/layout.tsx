import type { Metadata } from "next"
import { DM_Serif_Display, Outfit } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

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

export const metadata: Metadata = {
  metadataBase: new URL("https://photoaura.app"),
  title: {
    default: "PhotoAura — Self-hosted photo gallery",
    template: "%s · PhotoAura",
  },
  description:
    "Open-source, self-hosted photo gallery with face recognition. Your photos, beautifully managed — and only ever yours.",
  icons: { icon: "/logo-color.png" },
  openGraph: {
    type: "website",
    title: "PhotoAura — Self-hosted photo gallery",
    description: "Your photos, beautifully managed — and only ever yours.",
    images: [{ url: "/logo-color.png" }],
  },
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
      </body>
    </html>
  )
}
