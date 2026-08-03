# APEXSTORAGE

A full-stack gold vault storage investment platform built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4**, and **Firebase Realtime Database**. Users can buy gold, request vault storage, manage shipments, track portfolio performance, and pay with crypto — all backed by real-time data and a dedicated admin console.

The app is a conversion of a static HTML/Alpine.js marketing site into a modern, type-safe, server-rendered application. See `worklog.md` for the full change history.

---

## Tech Stack

| Layer            | Tools                                                           |
| ---------------- | --------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, `output: "standalone"`)                 |
| Language         | TypeScript 5, React 19                                          |
| Styling          | Tailwind CSS 4, shadcn/ui (New York style), `tw-animate-css`    |
| UI Components    | Radix UI (`@radix-ui/react-toast`), Lucide icons                |
| Charts           | Chart.js 4 + `react-chartjs-2`                                  |
| Auth & DB        | Firebase Authentication + Firebase Realtime Database            |
| Crypto Payments  | NOWPayments (REST + IPN webhook)                                |
| Server / Proxy   | Next.js API routes, Caddyfile for reverse-proxying              |
| Linting          | ESLint 9 with `eslint-config-next`                              |

---

## Features

### Public
- Marketing landing page with hero carousel, "How It Works", Global Vault Network (Zurich, Singapore, London, New York), interactive ROI calculator, and live 90-day gold price chart.
- Contact form (persisted to RTDB), FAQ, Privacy Policy, Terms of Service.
- Newsletter subscription (persisted to RTDB via server API).

### Authentication
- Email/password sign-up & sign-in.
- Google Sign-In.
- Admin 2FA via SHA-256 + salt-hashed 4–6 digit PIN, with a dedicated 6-box PIN entry screen on login.
- Auth state exposed through a React context (`src/lib/auth-context.tsx`).
- Route protection on `/dashboard/client` and `/dashboard/admin` based on `authRole` from `NEXT_PUBLIC_ADMIN_EMAILS`.

### Client Dashboard (`/dashboard/client`)
- 6 sections: Dashboard, Holdings, Orders, Shipments, Vault, Analytics.
- All data is real-time, filtered by the logged-in user's UID/email.
- Portfolio donut, monthly growth, storage fees, returns bar, and allocation charts.
- Buy gold modal, multi-step vault request modal, 5-step shipment wizard, profile settings with vault location, 2FA setup (admins).

### Admin Dashboard (`/dashboard/admin`)
- Overview stats pulled live from RTDB: users, assets, vault requests, orders, shipments, messages, newsletter subscribers.
- Full CRUD for assets and read/manage for users.
- Management Approvals hub: pending vault requests, pending orders, pending shipments, plus a combined approval history.
- Operations Orders with status filter tabs (All / Pending / Processing / Completed / Cancelled), order detail modal, contextual lifecycle actions, and "Approved Shipments — Ready to Ship".
- Contact messages inbox with real-time read/delete.
- Newsletter subscribers table.
- Server-side data fallback (`/api/admin/data`) for cases where RTDB security rules block client reads; client polls every 30 s.

### Real-time Data
- `src/lib/*-service.ts` modules wrap Firebase RTDB with `onValue` subscriptions and CRUD helpers:
  - `users-service`, `assets-service`, `orders-service`, `shipments-service`, `vault-requests.ts`, `messages.ts`, `newsletter.ts`, `transactions-service.ts`.
- All subscriptions are guarded by `authLoading` + `authRole` checks to avoid `PERMISSION_DENIED` before auth state resolves.

### Gold Price
- `/api/gold-price` server route fetches the spot price with `metals.live` as the primary source and CoinGecko as a fallback, cached for 30 s.

### Crypto Payments
- NOWPayments client service (`src/lib/nowpayments-service.ts`) creates payment invoices.
- IPN webhook at `/api/payments/nowpayments-webhook` validates and writes transactions to RTDB under `transactions/{id}`.

---

## Project Structure

```
workspace/
├── src/
│   ├── app/
│   │   ├── api/                 # Server routes
│   │   │   ├── admin/data/      #   - server-side RTDB fallback
│   │   │   ├── client/data/     #   - client-side data fetch
│   │   │   ├── gold-price/      #   - spot price proxy
│   │   │   ├── newsletter/      #   - newsletter subscription write
│   │   │   └── payments/nowpayments-webhook/  # - IPN handler
│   │   ├── auth/                # Login, register, verified
│   │   ├── dashboard/
│   │   │   ├── admin/           # Admin console
│   │   │   └── client/          # Client portal
│   │   ├── contact/, faq/, privacy/, terms/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Landing page
│   │   └── globals.css          # Custom APEXSTORAGE theme tokens
│   ├── components/
│   │   ├── charts/              # Chart.js wrappers (donut, bar, etc.)
│   │   ├── layout/              # Navbar, Footer, Sidebar
│   │   ├── modals/              # Auth, BuyGold, GetVault, Shipment, Profile, CryptoCheckout, PerformanceChart
│   │   ├── ui/                  # shadcn primitives + toaster
│   │   └── TransactionHistory.tsx
│   ├── hooks/use-toast.ts
│   └── lib/                     # Firebase, auth context, RTDB services, gold price, NOWPayments, utils
├── public/                      # Static assets (favicon, hero & vault images, logo, robots)
├── scripts/copy-standalone-assets.mjs   # Post-build step for `next start` standalone
├── Caddyfile                    # Reverse proxy on :81 -> :3000 (or ?XTransformPort= for dev port)
├── components.json              # shadcn/ui config
├── next.config.ts               # `output: "standalone"`
├── postcss.config.mjs
├── tailwind/                    # (configured via @tailwindcss/postcss)
├── tsconfig.json
├── eslint.config.mjs
├── rtdb-rules.json              # Recommended Firebase Realtime DB rules
├── .env.example
└── worklog.md                   # Project change log
```

---

## Getting Started

### Prerequisites
- Node.js 20+ (required by Next.js 16)
- npm, pnpm, or yarn
- A Firebase project with **Authentication** (Email/Password + Google) and **Realtime Database** enabled

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Comma-separated list of admin emails (controls authRole === 'admin')
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com

# NOWPayments (https://nowpayments.io/merchants)
NEXT_PUBLIC_NOWPAYMENTS_API_KEY=...
NOWPAYMENTS_IPN_SECRET=...
```

> The `NEXT_PUBLIC_*` variables are exposed to the browser; keep any truly private keys (like the NOWPayments IPN secret) server-only.

### Apply Realtime Database rules

The repository ships a recommended ruleset in `rtdb-rules.json`. Paste it into **Firebase Console → Realtime Database → Rules** and publish. The rules cover:

| Path             | Read             | Write                                |
| ---------------- | ---------------- | ------------------------------------ |
| `users`          | any auth user    | owner only (`$uid === auth.uid`)     |
| `vaultRequests`  | any auth user    | any auth user                        |
| `contactMessages`| public           | any auth user (open for contact form)|
| `assets`         | any auth user    | any auth user                        |
| `orders`         | any auth user    | any auth user                        |
| `shipments`      | any auth user    | any auth user                        |
| `newsletter`     | any auth user    | open (for unauthenticated visitors)  |
| `transactions`   | any auth user    | owner or admin                       |

Tighten these rules for production.

### Run

```bash
npm run dev        # http://localhost:3000
npm run lint       # ESLint
npm run build      # Production build (writes .next/standalone)
npm start          # Serve the standalone build
```

`npm run build` invokes `scripts/copy-standalone-assets.mjs` to copy `public/` and `.next/static/` into the standalone output so `node .next/standalone/server.js` can serve the app on its own.

---

## Deployment

### Netlify (recommended for serverless / preview deploys)

The project is pre-wired for Netlify — see `netlify.toml`, `.nvmrc`, and the `@netlify/plugin-nextjs` dev dependency. The plugin turns Next.js API routes into Netlify Functions and handles SSR/ISR/image optimization automatically.

**One-time setup**

1. Push the repo to GitHub/GitLab/Bitbucket.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Netlify auto-detects Next.js and uses `netlify.toml` for settings. Confirm:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Functions directory: auto (managed by the plugin)
4. **Add environment variables** in *Site settings → Environment variables*. See `.env.example` for the full list. All `NEXT_PUBLIC_*` values are exposed to the browser; keep `NOWPAYMENTS_IPN_SECRET` server-only.
5. Trigger a deploy. The first build also installs `@netlify/plugin-nextjs` and sets up Function bundling.

**Required environment variables (Netlify UI)**

| Variable | Scope |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public (browser) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public (browser) |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Public (browser) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public (browser) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public (browser) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public (browser) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public (browser) |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Public (browser) |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Public (browser) |
| `NEXT_PUBLIC_NOWPAYMENTS_API_KEY` | Public (browser) |
| `NOWPAYMENTS_IPN_SECRET` | Server only |

> Don't commit `.env.local` to the repo. It is already excluded via `.gitignore`.

**Routing / security**

- `netlify.toml` adds HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and a minimal Permissions-Policy.
- `_next/static/*` and images are served with `Cache-Control: public, max-age=31536000, immutable`.
- The plugin auto-generates redirects for Next.js routes; do not add a catch-all `/* → /index.html` rule or it will shadow the API routes.

**Webhooks**

Point NOWPayments IPN callbacks at `https://<your-site>.netlify.app/api/payments/nowpayments-webhook`. The handler verifies the `x-nowpayments-sig` HMAC-SHA512 header against `NOWPAYMENTS_IPN_SECRET` and updates RTDB via the REST API.

**Local Netlify preview**

```bash
npm install -g netlify-cli
netlify link                # link to your site
netlify env:import .env.local   # copy env vars to Netlify
netlify dev                 # http://localhost:8888
```

### Self-host / Docker / VM (standalone)

The original Caddyfile-based flow still works for self-hosted deployments:

```bash
npm run build:standalone    # produces .next/standalone/ with assets
npm start                   # node .next/standalone/server.js on :3000
```

`netlify.toml` is ignored in this mode. The `Caddyfile` listens on `:81` and reverse-proxies to `:3000`. Use the `?XTransformPort=<port>` query parameter to route to alternative dev servers.

---

## Conventions

- Path alias: `@/*` → `src/*` (set in `tsconfig.json`).
- Styling: prefer the custom utility classes in `globals.css` (`btn-gold`, `input-aurum`, `nav-link`, `gold-gradient`, `custom-scrollbar`) plus Tailwind 4 utilities.
- Auth-aware rendering: any component that reads RTDB data should check `authLoading` and `authRole` before subscribing, and clean up on unmount.
- 2FA PINs are **never** stored in plaintext — `hashPin()` in `src/lib/auth-context.tsx` applies SHA-256 with a salt.
- `worklog.md` is the authoritative project history; update it whenever you finish a meaningful chunk of work.

---

## License

Proprietary — internal/demo project. All rights reserved by the project owner.
