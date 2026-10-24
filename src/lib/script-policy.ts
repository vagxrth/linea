// The Content-Security-Policy the middleware sends with each page. It only limits scripts: images,
// styles, fonts and connections stay open, since a generated design's frame inherits the page's
// policy and designs load images and fonts from anywhere.
export const scriptPolicy = (nonce: string, development = process.env.NODE_ENV === 'development') =>
    [
        // A script runs only when it carries this response's nonce or comes from linea itself. Next.js
        // puts the nonce on the scripts in each page and loads later chunks from linea. vercel.live
        // serves the Vercel toolbar on preview deployments.
        `script-src 'self' 'nonce-${nonce}' https://vercel.live${development ? DEVELOPMENT_SOURCES : ''}`,
        // No plugins, and no <base> element sending the page's relative URLs to another site
        "object-src 'none'",
        "base-uri 'self'",
        // The same as next.config.ts sends with every response
        "frame-ancestors 'self'",
    ].join('; ')

// The development server evaluates code for fast refresh, and Vercel Analytics loads its debug
// script from Vercel
const DEVELOPMENT_SOURCES = " 'unsafe-eval' https://va.vercel-scripts.com"
