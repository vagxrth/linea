# Linea

**Think. Sketch. Design.**

Linea is an AI-powered design tool that transforms hand-drawn sketches and wireframes into polished, production-ready designs. It features an infinite canvas for sketching, AI-driven style guide generation from moodboard images, and automatic workflow page creation — all within a seamless SaaS experience.

## Features

- **Infinite Canvas** — Draw shapes (rectangles, ellipses, arrows, lines, freehand), add text, pan/zoom, select several shapes at once, undo/redo, and auto-save as you work.
- **Wireframe-to-Design** — Sketch a wireframe inside a frame, and Linea generates a complete HTML/CSS design using your style guide, with WCAG AA accessibility baked in.
- **Style Guide Generation** — Upload moodboard images and Linea extracts a full design system: color palette (primary, secondary, UI, utility, status), typography hierarchy, and spacing guidelines.
- **Workflow Pages** — Automatically generate complementary pages (dashboards, settings, profiles, data tables) that match your primary design's visual language.
- **Inspiration Sidebar** — Attach reference images that inform the AI during design generation.
- **Project Management** — Create, rename and delete projects. Each one auto-saves and gets a generated thumbnail.
- **Subscription Billing** — $10/month plan with 50 AI credits per billing period, powered by Polar.

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Frontend** | React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4, shadcn/ui (Radix UI) |
| **State Management** | Redux Toolkit, RTK Query |
| **3D / Landing** | Three.js, React Three Fiber, Drei |
| **Database** | Convex (real-time serverless database) |
| **Authentication** | Convex Auth (email/password + Google OAuth) |
| **Email** | Resend (verification and password reset codes) |
| **AI** | Google Gemini 2.5 Flash via Vercel AI SDK |
| **Payments** | Polar ($10/mo subscription + credits) |
| **Analytics** | Vercel Analytics |
| **Deployment** | Vercel |

## Project Structure

```
linea/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page (3D gallery)
│   │   ├── auth/                     # Sign in, sign up and password reset pages
│   │   ├── (protected)/              # Auth-guarded routes
│   │   │   ├── dashboard/            # Projects list
│   │   │   │   └── [session]/        # Workspace
│   │   │   │       ├── canvas/       # Infinite canvas editor
│   │   │   │       └── style-guide/  # Style guide editor
│   │   │   └── billing/              # Subscription management
│   │   └── api/
│   │       ├── generate/             # AI generation endpoints
│   │       │   ├── route.ts          # Wireframe → design
│   │       │   ├── style/            # Moodboard → style guide
│   │       │   └── workflow/         # Complementary page generation
│   │       └── billing/              # Polar checkout and customer portal
│   ├── components/                   # UI components
│   │   ├── canvas/                   # Canvas rendering
│   │   ├── shapes/                   # Shape components
│   │   ├── toolbar/                  # Canvas toolbar
│   │   ├── moodboard/                # Moodboard uploads
│   │   └── ui/                       # shadcn/ui primitives
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-canvas.ts             # Canvas state & interactions
│   │   ├── use-project.ts            # Project CRUD
│   │   ├── use-styles.ts             # Style guide management
│   │   └── use-subscription.ts       # Entitlement checks
│   ├── redux/                        # Redux store, slices, API
│   ├── prompts/                      # AI system prompts
│   └── middleware.ts                 # Auth & route protection
├── convex/                           # Convex backend
│   ├── schema.ts                     # Database schema
│   ├── auth.ts                       # Auth configuration
│   ├── otp.ts                        # Emailed verification and reset codes
│   ├── http.ts                       # HTTP routes (auth, Polar webhook)
│   ├── user.ts                       # User queries
│   ├── projects.ts                   # Project mutations/queries
│   ├── subscription.ts               # Credits & subscription logic
│   ├── moodboard.ts                  # Moodboard image storage
│   └── inspiration.ts                # Inspiration image storage
└── public/                           # Static assets
```

## Prerequisites

- **Node.js** 18+
- **npm** (ships with Node)
- A **Convex** account — [convex.dev](https://www.convex.dev)
- A **Google Cloud** project with OAuth 2.0 credentials
- A **Google AI** (Gemini) API key — [ai.google.dev](https://ai.google.dev)
- A **Polar** account for payments — [polar.sh](https://polar.sh)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/vagxrth/linea.git
cd linea
```

### 2. Install dependencies

```bash
npm install
```

The backend's settings live on your Convex deployment (set with `npx convex env set`), and the Next.js app's settings live in `.env.local`. The steps below set both.

### 3. Set up Convex

```bash
npx convex dev
```

This prompts you to create a Convex project (or link to an existing one), pushes the `convex/` functions to your dev deployment, and writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Leave it running in its own terminal while you work.

### 4. Set up Convex Auth

In a second terminal:

```bash
npx @convex-dev/auth
```

This sets `SITE_URL`, `JWT_PRIVATE_KEY` and `JWKS` on your Convex deployment, which sign-in needs. When it asks for your site's URL, use `http://localhost:3000`. The repo already has its auth files in `convex/`, so if it offers to replace any of them, say no.

### 5. Set up Google sign-in

In the Google Cloud Console, create an OAuth client of type **Web application** and add this authorized redirect URI:

```
https://<your-deployment>.convex.site/api/auth/callback/google
```

Use your deployment's HTTP Actions URL, which ends in `.convex.site` and is shown in the Convex dashboard's settings. Then set the client's ID and secret on Convex. Convex Auth reads them there, not from `.env.local`:

```bash
npx convex env set AUTH_GOOGLE_ID <your-google-client-id>
npx convex env set AUTH_GOOGLE_SECRET <your-google-client-secret>
```

### 6. Send email codes (required for email and password accounts)

New email and password accounts confirm their email with an emailed code, and forgotten passwords are reset with one. The codes are sent through [Resend](https://resend.com). Verify your sending domain in Resend, create an API key, and set both on Convex:

```bash
npx convex env set AUTH_RESEND_KEY <your-resend-api-key>
npx convex env set AUTH_EMAIL_FROM "Linea <noreply@your-domain.com>"
```

Without them, email and password sign-ups can't finish. Google sign-in doesn't use them.

### 7. Add the Next.js environment variables

Add these to `.env.local`, below the two lines `npx convex dev` wrote:

```env
# Google Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY=<your-gemini-api-key>

# Polar (payments)
POLAR_ACCESS_TOKEN=<your-polar-access-token>
POLAR_PLAN=<your-polar-product-id>
POLAR_ENV=sandbox

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`CONVEX_SITE_URL` doesn't belong here: Convex sets it on the deployment by itself.

### 8. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 9. Receive Polar webhooks (optional, for billing)

Polar webhooks are handled by the Convex deployment, not the Next.js app. Set the webhook secret on Convex:

```bash
npx convex env set POLAR_WEBHOOK_SECRET <your-polar-webhook-secret>
```

Then point a Polar webhook at `https://<your-deployment>.convex.site/polar/webhook` with the `subscription.*` and `order.*` events.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate Next.js route types, then type-check with TypeScript |
| `npx convex dev` | Start Convex dev sync |

GitHub runs `npm run typecheck` and `npm run lint` on every pull request and every push to `main` (`.github/workflows/checks.yml`).

## Database Schema

Linea uses Convex with the following core tables:

- **users** — Managed by Convex Auth (email, name, image, OAuth accounts)
- **projects** — Names, style guides, moodboard/inspiration images and thumbnails
- **project_sketches** — Each project's drawing, including its generated designs, and viewport, kept apart so listing projects stays cheap
- **subscriptions** — Polar subscription state and credit balance
- **credits_ledger** — Log of credit grants and charges, with idempotency keys

## Authentication

Linea supports two auth methods via Convex Auth:

- **Email/Password** — Sign-up confirms the email with an emailed 8-digit code, and "Forgot your Password?" (`/auth/reset`) resets a password with one
- **Google OAuth** — One-click sign-in with Google

Routes are protected by Next.js middleware:
- `/` and `/auth/*` — Public (redirects to dashboard if already signed in)
- `/dashboard/*` and `/billing/*` — Protected (redirects to sign-in if not authenticated)
- `/api/auth/*` and `/convex/*` — Bypassed (no auth required)

## Billing & Credits

| Detail | Value |
|---|---|
| Price | $10/month |
| Credits per period | 50 |
| Unused credits | Don't roll over: the balance resets to 50 at each renewal |
| Payment provider | Polar |

| AI action | Credits |
|---|---|
| Generate a design from a frame | 1 |
| Generate a style guide | 1 |
| Redesign a design through chat | 1 |
| Generate workflow pages | 4 (1 for each of the 4 pages) |
| Redesign a workflow page through chat | 4 |

Credits are charged only once the AI starts returning output, so a failed generation costs nothing. They're granted when a subscription starts and at each renewal, by the Polar webhook handler in `convex/http.ts`.

## Deployment

Linea runs the Next.js app on **Vercel** and the backend on **Convex**. Vercel's build only runs `npm run build`, so the Convex functions are deployed separately:

1. Push your repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Deploy the Convex functions to your production deployment with `npx convex deploy`. Run it again whenever `convex/` changes.
3. Run `npx @convex-dev/auth --prod`, and give your production domain as the site URL.
4. Set the backend's settings on the production deployment with `npx convex env set --prod`: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` and `POLAR_WEBHOOK_SECRET`.
5. In the Vercel project settings, add `NEXT_PUBLIC_CONVEX_URL` (your production deployment's URL), `GOOGLE_GENERATIVE_AI_API_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_PLAN`, `POLAR_ENV=production` and `NEXT_PUBLIC_APP_URL` (your domain). `CONVEX_DEPLOYMENT` is only for the Convex CLI and doesn't belong in Vercel.
6. In Google Cloud, add `https://<your-prod-deployment>.convex.site/api/auth/callback/google` to the OAuth client's authorized redirect URIs.
7. Point the Polar webhook at `https://<your-prod-deployment>.convex.site/polar/webhook`.

