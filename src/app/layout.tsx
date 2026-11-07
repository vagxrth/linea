import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AppToaster from "@/components/app-toaster";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// For code. Generated designs get the app's fonts, so their font-mono and <code> use it too. It isn't
// preloaded: most pages never show code, and the browser fetches it the first time one does.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const instrumentSerif = Instrument_Serif({
	variable: '--font-instrument',
	subsets: ['latin'],
	weight: '400',
	style: ['italic', 'normal'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://linea.vagarth.in'),
  title: "Linea",
  description: "Sketch a wireframe. Get a designed page. Linea turns hand-drawn wireframes into HTML/CSS pages, styled by a design system it builds from your moodboard.",
  openGraph: {
    url: 'https://linea.vagarth.in',
    siteName: 'Linea',
    locale: 'en_US',
    type: 'website',
    images: [{
      url: '/images/open-graph.png',
      width: 1200,
      height: 630,
      alt: 'Linea'
    }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // The middleware's nonce, for the script next-themes adds to set the dark theme before the first paint
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <ConvexAuthNextjsServerProvider>
      {/* data-scroll-behavior: the landing page scrolls smoothly to its sections (globals.css), and
          this tells Next.js to turn that off while it changes pages, so a new page opens at the top at once */}
      <html lang="en" className='bg-background' data-scroll-behavior='smooth' suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
        >
          <ConvexClientProvider>
            {/* The canvas and panels are drawn for a dark background (white strokes and labels),
                so the theme stays dark instead of following the OS */}
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              enableSystem={false}
              disableTransitionOnChange
              nonce={nonce}
            >
              {children}
              <Analytics />
              <AppToaster />
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
