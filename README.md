<p align="center">
  <img src="public/images/open-graph.png" alt="Linea: think. sketch. design." width="100%" />
</p>

<h1 align="center">Linea</h1>

<p align="center">
  <strong>Sketch a wireframe. Get a production-ready design.</strong><br />
  Linea is an AI design tool that turns hand-drawn wireframes into polished HTML/CSS pages, styled by a design system it builds from your moodboard.
</p>

<p align="center">
  <a href="https://linea.vagarth.in"><strong>Try Linea free</strong></a> ·
  <a href="#pricing">Pricing</a> ·
  <a href="https://github.com/vagxrth/linea/issues">Report an issue</a>
</p>

<p align="center">
  <a href="https://github.com/vagxrth/linea/actions/workflows/checks.yml"><img src="https://github.com/vagxrth/linea/actions/workflows/checks.yml/badge.svg" alt="Checks" /></a>
</p>

## Features

- **Infinite canvas.** Sketch with shapes, arrows, lines, text and freehand. Select, copy, paste, undo and zoom, and every change saves automatically.
- **Wireframe to design.** Draw a layout inside a frame and generate a complete, accessible HTML/CSS page from it.
- **Style guide from a moodboard.** Upload reference images and get a color palette, type scale and spacing rules that every design follows.
- **Matching pages.** Generate dashboards, settings, profiles and listings in the same visual language as your design.
- **Redesign in chat.** Describe a change in plain words and the design updates in place.
- **Export.** Download any design or frame as an image.

## Pricing

| Plan | Price | Credits |
|---|---|---|
| **Free** | $0 | 10 credits to try Linea |
| **Pro** | $15 a month, or $120 a year | 100 credits every month |

A generated or redesigned page uses 1 credit, a style guide uses 1, and a 4-page workflow uses 4. Generations that fail cost nothing. Subscribe from the app, then switch plans or cancel anytime from **Manage plan**.

## Built with

[Next.js](https://nextjs.org) · [React](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Tailwind CSS](https://tailwindcss.com) · [shadcn/ui](https://ui.shadcn.com) · [Convex](https://www.convex.dev) · [Google Gemini](https://ai.google.dev) with the [AI SDK](https://ai-sdk.dev) · [Polar](https://polar.sh) · [Resend](https://resend.com) · [Vercel](https://vercel.com)

## Run it locally

You'll need Node.js 22 or later, and accounts with Convex, Google Cloud (for sign-in), Google AI Studio (for Gemini) and Resend. Polar is only needed to test billing.

```bash
git clone https://github.com/vagxrth/linea.git
cd linea
npm install
npx convex dev   # creates a dev deployment and writes .env.local; leave it running
```

Then finish the setup below in a second terminal and start the app with `npm run dev`.

<details>
<summary><strong>Full setup</strong></summary>

1. **Sign-in keys.** Run `npx @convex-dev/auth` and give `http://localhost:3000` as the site URL. If it offers to replace files in `convex/`, say no.

2. **Google sign-in.** Create a Google OAuth client of type *Web application* with this redirect URI, using your deployment's `.convex.site` address from the Convex dashboard:

   ```
   https://<your-deployment>.convex.site/api/auth/callback/google
   ```

   Then set its ID and secret on Convex:

   ```bash
   npx convex env set AUTH_GOOGLE_ID <client-id>
   npx convex env set AUTH_GOOGLE_SECRET <client-secret>
   ```

3. **Email codes.** Email sign-ups and password resets send a code through Resend. Verify your sending domain there, then:

   ```bash
   npx convex env set AUTH_RESEND_KEY <resend-api-key>
   npx convex env set AUTH_EMAIL_FROM "Linea <noreply@your-domain.com>"
   ```

4. **App settings.** Add these to `.env.local`, below the lines `npx convex dev` wrote:

   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=<gemini-api-key>
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Keeps billing on Polar's sandbox. Without it, Linea uses Polar production.
   POLAR_ENV=sandbox
   # Only needed to test billing
   POLAR_ACCESS_TOKEN=<polar-sandbox-token>
   POLAR_PLAN=<monthly-product-id>,<yearly-product-id>
   ```

5. **Billing webhooks (optional).** Polar's webhooks go to Convex. Set the webhook's secret and the same product ids there, then point a Polar sandbox webhook at `https://<your-deployment>.convex.site/polar/webhook` with the `subscription.*` and `order.*` events:

   ```bash
   npx convex env set POLAR_WEBHOOK_SECRET <webhook-secret>
   npx convex env set POLAR_PLAN <monthly-product-id>,<yearly-product-id>
   ```

6. **Run it** with `npm run dev` and open [localhost:3000](http://localhost:3000).

Before pushing, run `npm run typecheck`, `npm run lint` and `npm test`. GitHub runs them on every pull request.

**Deploying:** Vercel builds only the Next.js app. Deploy the backend with `npx convex deploy` whenever `convex/` changes, and set production settings with `npx convex env set --prod`.

</details>

## Support

Found a bug or have a question? [Open an issue](https://github.com/vagxrth/linea/issues).

## License

Copyright © 2025–2026 Vagarth Pandey. All rights reserved.
