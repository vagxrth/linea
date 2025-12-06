import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import ReduxProvider from "@/redux/provider";
import { ProfileQuery } from "@/convex/query.config";
import { ConvexUserRaw, normalizeProfile } from "@/types/user";
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
  description: "Think. Sketch. Design",
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

  let profile = null;
  try {
    const rawProfile = await ProfileQuery();
    profile = normalizeProfile( rawProfile._valueJSON as unknown as ConvexUserRaw | null );
  } catch (error) {
    // Gracefully handle profile query errors instead of crashing
    console.error('Profile query error:', error);
    profile = null;
  }

  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className='bg-background'>
        <body
          className={`${geistSans.variable} ${instrumentSerif.variable} antialiased`}
        >
          <ConvexClientProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ReduxProvider preloadedState={{ profile }}>
                {children}
                <Analytics />
                <Toaster />
              </ReduxProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
