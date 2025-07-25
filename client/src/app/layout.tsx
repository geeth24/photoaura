import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import Header from '@/components/Header';

const blackMud = localFont({
  src: './Blackmud-VGoOx.ttf',
  display: 'swap',
  variable: '--font-blackmud',
});

const lato = Lato({
  subsets: ['latin'],
  display: 'swap',
  weight: ['100', '300', '400', '700', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'PhotoAura',
  description: 'All your photos in one place',
  openGraph: {
    images: [
      {
        url: 'https://aura.reactiveshots.com/images/Logo-Banner.png',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests"></meta>  */}
      <link rel="icon" href="/images/logo-color.png" />

      <body className={`${blackMud.variable} ${lato.className}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster richColors />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
