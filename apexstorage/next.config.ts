import type { NextConfig } from "next";

const isStandalone = process.env.BUILD_STANDALONE === "1";

const nextConfig: NextConfig = {
  // `output: "standalone"` is only used for self-hosted Docker/VM deploys.
  // For Vercel, the Next.js runtime is handled by the platform — leave this
  // off so we don't produce an extra .next/standalone tree that goes unused.
  ...(isStandalone ? { output: "standalone" as const } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // firebase-admin's auth module pulls jwks-rsa -> jose. jose v6 is ESM-only
  // (its exports map has no `require` condition and no CJS build), and when
  // Turbopack bundles it into the serverless function it emits a runtime
  // `require('jose/dist/webapi/index.js')` which Vercel's Node runtime rejects
  // with ERR_REQUIRE_ESM — every route importing firebase-admin 500'd at
  // module load in production. Pinning jose to v5 (CJS build, same API) via
  // package.json overrides AND keeping these packages external keeps the
  // require chain (firebase-admin -> jwks-rsa -> jose) resolving through
  // Node's own resolver at runtime, which selects jose's `require` condition
  // -> dist/cjs. Local Node 24 tolerated the ESM require; Vercel's runtime
  // does not, so this must stay external.
  serverExternalPackages: ['firebase-admin', 'jwks-rsa', 'jose'],
  async headers() {
    // Immutable caching for /_next/static is PRODUCTION-ONLY. In dev,
    // Turbopack keeps stable chunk URLs while their content changes, so
    // immutable caching makes the browser serve stale CSS/JS forever
    // (stale styles, missing rules, hydration mismatches). Dev gets
    // no-store so every load reflects the current source.
    const assetHeaders =
      process.env.NODE_ENV === "production"
        ? [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
        : [{ key: "Cache-Control", value: "no-store" }];
    return [
      {
        source: "/sitemap.xml",
        headers: [
          { key: "Content-Type", value: "application/xml" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: assetHeaders,
      },
      {
        source: "/images/(.*)",
        headers: assetHeaders,
      },
    ];
  },
};

export default nextConfig;
