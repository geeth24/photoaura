import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';
import Navbar from '@/components/Navbar';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <link rel="icon" href="/logo-color.png" />
      <body className={lato.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
