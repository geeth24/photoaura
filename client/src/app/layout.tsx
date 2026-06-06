import type { Metadata } from "next"
import { DM_Serif_Display, Outfit } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { Analytics } from "@vercel/analytics/next"

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
  title: "PhotoAura",
  description: "Photo management dashboard",
  icons: { icon: "/images/logo-color.png" },
  // Apple Smart App Banner — on iPhone Safari, offers to open/install the app
  itunes: { appId: "6477320360" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${dmSerif.variable} ${outfit.variable} ${blackMud.variable}`}
    >
      <body className="font-body antialiased min-h-dvh">
        {children}
        <Toaster richColors />
        <Analytics />
      </body>
    </html>
  )
}
