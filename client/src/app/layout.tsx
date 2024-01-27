import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';

const lato = Lato({
  subsets: ['latin'],
  display: 'swap',
  weight: ['100', '300', '400', '700', '900'],
});

export const metadata: Metadata = {
  title: 'PhotoAura',
  description: 'All your photos in one place',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://photoaura.reactiveshots.com',
    images: [
      {
        url: '/images/Logo-Banner.png',
        width: 1200,
        height: 630,
        alt: 'PhotoAura',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests"></meta>
      <body className={lato.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
