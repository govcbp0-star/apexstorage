# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 App Router application using TypeScript, React 19, Tailwind CSS 4, and Firebase Realtime Database. Route pages and API handlers live in `src/app/`; API endpoints use the App Router pattern, for example `src/app/api/gold-price/route.ts`. Reusable UI is grouped in `src/components/` by purpose (`charts/`, `layout/`, `modals/`, and `ui/`). Put Firebase access, domain services, contexts, helpers, and email templates in `src/lib/`; keep new hooks in `src/hooks/`. Static images and icons belong in `public/`, while one-off build and data utilities belong in `scripts/`.

## Build, Test, and Development Commands

- `npm ci` installs the lockfile-pinned dependencies used by CI.
- `npm run dev` starts the local app at `http://localhost:3000`.
- `npm run lint` runs ESLint with the Next.js core-web-vitals and TypeScript configs.
- `npm test` runs the Node built-in test suite for `src/lib/*.test.ts`.
- `npm run build` creates the production bundle and validates the compiled CSS and `jose` bundle.
- `npm run build:standalone` creates the standalone deployment output; run `npm start` afterward.

Use Node 24, as specified in `.nvmrc` and CI.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, semicolons, and double-quoted imports. Name React components in PascalCase (`BuyGoldModal.tsx`), hooks with `use` (`use-chart-theme.ts`), and service/helper modules in kebab-case (`shipment-fee.ts`). Mark client-only code with `"use client"` where required. Reuse Tailwind classes and `src/app/globals.css` theme tokens. Run lint before opening a PR.

## Testing Guidelines

Tests use the native `node:test` runner and live beside library code as `*.test.ts`, such as `src/lib/shipment-fee.test.ts`. Add focused tests for pricing, validation, signatures, and service behavior. Run `npm test`; run `npm run build` when changing CSS, tooling, routes, or server code. CI requires lint, tests, a CSS check, and a production build.

## Security, Commits & Pull Requests

Never commit `.env` files, Firebase service-account JSON, payment credentials, or webhook secrets. Keep server-only credentials out of `NEXT_PUBLIC_*` variables and update `rtdb-rules.json` when database access changes.

The repository has no Git commits, so no local convention exists. Use concise imperative Conventional Commit-style subjects, e.g. `feat: add shipment tracking status`. PRs should describe the change, note configuration or data-rule changes, link issues when available, and include screenshots for visual changes. Confirm relevant checks pass before review.
