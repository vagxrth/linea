# Linea

**Think. Sketch. Design.**

Linea is an AI-powered design tool that transforms hand-drawn sketches and wireframes into polished, production-ready designs. It features an infinite canvas for sketching, AI-driven style guide generation from moodboard images, and automatic workflow page creation — all within a seamless SaaS experience.

## Features

- **Infinite Canvas** — Draw shapes (rectangles, ellipses, arrows, lines, freehand), add text, pan/zoom, multi-select, group with frames, and auto-save in real time.
- **Wireframe-to-Design** — Upload or sketch a wireframe, and Linea generates a complete HTML/CSS design using your style guide, with WCAG AA accessibility baked in.
- **Style Guide Generation** — Upload moodboard images and Linea extracts a full design system: color palette (primary, secondary, UI, utility, status), typography hierarchy, and spacing guidelines.
- **Workflow Pages** — Automatically generate complementary pages (dashboards, settings, profiles, data tables) that match your primary design's visual language.
- **Inspiration Sidebar** — Attach reference images that inform the AI during design generation.
- **Project Management** — Create, rename, delete, and organize projects with auto-save, thumbnails, and public/private sharing.
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
| **AI** | Google Gemini 2.5 Flash via Vercel AI SDK |
| **Payments** | Polar ($10/mo subscription + credits) |
| **Background Jobs** | Inngest (autosave, webhook processing) |
| **Analytics** | Vercel Analytics |
| **Deployment** | Vercel |

## Project Structure

```
linea/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page (3D gallery)
│   │   ├── auth/                     # Sign in / Sign up pages
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
│   │       ├── billing/              # Checkout & webhook handlers
│   │       └── inngest/              # Background job serve endpoint
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
│   ├── inngest/                      # Background job definitions
│   ├── prompts/                      # AI system prompts
│   └── middleware.ts                 # Auth & route protection
├── convex/                           # Convex backend
│   ├── schema.ts                     # Database schema
│   ├── auth.ts                       # Auth configuration
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
- An **Inngest** account for background jobs — [inngest.com](https://www.inngest.com)

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

### 3. Set up Convex

```bash
npx convex dev
```

This will prompt you to create a Convex project (or link to an existing one) and start syncing your `convex/` backend functions.

### 4. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Convex
CONVEX_DEPLOYMENT=<your-convex-deployment>
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
CONVEX_SITE_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>

# Google Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY=<your-gemini-api-key>

# Polar (Payments)
POLAR_ACCESS_TOKEN=<your-polar-access-token>
POLAR_WEBHOOK_SECRET=<your-polar-webhook-secret>
POLAR_PLAN=<your-polar-plan-id>
POLAR_ENV=sandbox

# Inngest (Background Jobs)
INNGEST_SIGNING_KEY=<your-inngest-signing-key>
INNGEST_EVENT_KEY=<your-inngest-event-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 6. Run Inngest (optional, for background jobs)

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest dev server which connects to your local app at `/api/inngest`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx convex dev` | Start Convex dev sync |

## Database Schema

Linea uses Convex with the following core tables:

- **users** — Managed by Convex Auth (email, name, image, OAuth accounts)
- **projects** — Canvas data, style guides, generated designs, moodboard/inspiration images, thumbnails
- **subscriptions** — Polar subscription state, credit balance, grant/rollover limits
- **credits_ledger** — Immutable log of credit grants and consumption with idempotency keys

## Authentication

Linea supports two auth methods via Convex Auth:

- **Email/Password** — Standard sign-up and sign-in forms
- **Google OAuth** — One-click sign-in with Google

Routes are protected by Next.js middleware:
- `/` and `/auth/*` — Public (redirects to dashboard if already signed in)
- `/dashboard/*` and `/billing/*` — Protected (redirects to sign-in if not authenticated)
- `/api/auth/*`, `/api/inngest/*`, `/api/polar/webhook` — Bypassed (no auth required)

## Billing & Credits

| Detail | Value |
|---|---|
| Price | $10/month |
| Credits per period | 50 |
| Cost per AI operation | 1 credit |
| Rollover limit | 50 credits |
| Payment provider | Polar |

Credits are granted on subscription creation and renewal via Inngest webhook processing. Each AI operation (style guide generation, wireframe-to-design, workflow page) consumes 1 credit.

## Deployment

Linea is designed to deploy on **Vercel**:

1. Push your repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add all environment variables from `.env.local` to the Vercel project settings.
4. Set up a **production Convex deployment** and update `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`.
5. Switch `POLAR_ENV` from `sandbox` to `production` and update Polar credentials.
6. Configure your custom domain and update `CONVEX_SITE_URL` and `NEXT_PUBLIC_APP_URL`.
7. Set up Polar webhook URL pointing to `https://yourdomain.com/api/billing/webhook`.
8. Ensure Google OAuth redirect URIs include your production domain.

