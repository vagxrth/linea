import type { NextConfig } from "next";

// Sent with every response. Vercel already adds Strict-Transport-Security.
const securityHeaders = [
  // Other sites can't show the app in a frame, so they can't trick clicks on it. The app can still
  // frame itself: the pitch page frames /pitch.pdf.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  // Browsers treat each file as the type it was sent as, never guessing another
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites see only linea's origin, not the paths, which hold user names and project ids
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The app uses none of these
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  /* config options here */
  // Every visitor gets the title and meta tags in the page's head, where crawlers and link previews
  // look. Otherwise Next.js streams them into the body when a page is ready before its metadata,
  // and the public pages are. The metadata is static, so waiting for it costs nothing.
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.convex.cloud',
      }
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
