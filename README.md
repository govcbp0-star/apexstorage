# APEXSTORAGE

A full-stack gold vault storage investment platform — **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4**, and **Firebase Realtime Database**, with crypto payments (NOWPayments) and branded transactional email (Resend).

> **The application lives in the [`apexstorage/`](./apexstorage) subfolder.**
> See [`apexstorage/README.md`](./apexstorage/README.md) for the full documentation: features, setup, environment variables, deployment, and conventions.

## Quick start

```bash
cd apexstorage
npm install
npm run dev        # http://localhost:3000
```

## Repository layout

```
.
├── apexstorage/          # The Next.js application (source, scripts)
├── .github/workflows/    # GitHub Actions CI (runs npm scripts inside apexstorage/)
└── .gitignore            # Workspace-level ignores
```

Note for deployments: point your platform's **root directory / build cwd** at `apexstorage/` (on Vercel: *Project Settings → General → Root Directory*).
