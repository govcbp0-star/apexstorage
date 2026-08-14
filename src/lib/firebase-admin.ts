import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getDatabase, type Database } from 'firebase-admin/database';

// ─────────────────────────────────────────────────────────────────────────────
// RTDB server-side reads via REST API (existing behavior — no service account
// needed; used by /api/admin/data and /api/client/data route handlers).
// ─────────────────────────────────────────────────────────────────────────────

const RTDB_BASE = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

/** Read RTDB via REST API using an optional ID token for authentication */
export async function readRTDB(path: string, idToken?: string): Promise<Record<string, any> | null> {
  // Strategy 1: REST API with ID token (authenticated read — works with "auth != null" rules)
  if (idToken) {
    try {
      const url = `${RTDB_BASE}/${path}.json?auth=${idToken}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data !== null && !data.error) return data;
      }
    } catch {
      // Token invalid, expired, or network error — try next strategy
    }
  }

  // Strategy 2: REST API without auth (only works if rules allow unauthenticated reads)
  try {
    const url = `${RTDB_BASE}/${path}.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data !== null && !data.error) return data;
    }
  } catch {
    // Network error or rules block unauthenticated reads
  }

  // Strategy 3: Client SDK (last resort — needs auth context, which server doesn't have).
  // The client SDK is imported LAZILY (and only here) so that merely importing this
  // server module never pulls the browser-targeted `firebase/database`/`./firebase`
  // packages into the module graph. On Vercel's serverless runtime that client SDK
  // fails to load at module scope (every route importing this module 500'd at boot),
  // so it must stay out of the top-level imports. Strategy 3 itself can never succeed
  // server-side (there is no auth context) and only ever returns null after the
  // 5s timeout — the REST strategies above are the real paths.
  try {
    const [{ ref, get }, { db }] = await Promise.all([
      import('firebase/database'),
      import('./firebase'),
    ]);
    const snap = await Promise.race([
      get(ref(db, path)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    return snap.exists() ? snap.val() : null;
  } catch {
    return null;
  }
}

/**
 * Write RTDB via REST API using an ID token for authentication.
 *
 * Mirrors the read strategy above (authenticated REST with the caller's
 * Firebase ID token) so server routes can persist small markers — e.g.
 * the shipment notification idempotency flag — on records the caller owns.
 * Returns true when the server accepted the write.
 */
export async function writeRTDB(
  path: string,
  data: Record<string, unknown>,
  idToken: string,
  method: 'PUT' | 'PATCH' = 'PATCH'
): Promise<boolean> {
  try {
    const url = `${RTDB_BASE}/${path}.json?auth=${encodeURIComponent(idToken)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK — server-only authentication operations.
//
// Used exclusively by Next.js Route Handlers to generate secure
// authentication links (email verification, password reset).
// Service account credentials are read from environment variables
// and are never exposed to the client.
//
// Required env vars (from Firebase Console → Project Settings → Service Accounts):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (multiline PEM — keep the \n escapes)
// ─────────────────────────────────────────────────────────────────────────────

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Database | null = null;

function normalizePrivateKey(): string | null {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!rawKey) return null;

  const privateKey = rawKey.trim().replace(/\\n/g, '\n');
  if (
    !privateKey.startsWith('-----BEGIN PRIVATE KEY-----') ||
    !privateKey.includes('-----END PRIVATE KEY-----')
  ) {
    return null;
  }

  return privateKey;
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    normalizePrivateKey()
  );
}

/**
 * The shared Firebase Admin app (service-account credentials + RTDB URL).
 *
 * Every Admin SDK service (auth, database) hangs off this one app so they
 * share a single credential initialization.
 */
function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  const privateKey = normalizePrivateKey();
  if (!isAdminConfigured()) {
    throw new Error(
      'Firebase Admin SDK is not configured correctly. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and a valid FIREBASE_PRIVATE_KEY PEM.'
    );
  }

  const config = {
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!.trim(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!.trim(),
      // The private key arrives with literal \n escapes — restore real newlines
      privateKey: privateKey!,
    }),
    // Needed by firebase-admin/database for server-side RTDB access
    // (the service account bypasses the database rules entirely, so
    // webhook/background writes work even on locked-down paths).
    databaseURL: RTDB_BASE,
  };

  const existing = getApps()[0];
  if (existing?.options.databaseURL) {
    // Reuse a fully-configured default app (e.g. from an earlier request in
    // a long-running process).
    cachedApp = existing;
    return existing;
  }

  if (existing) {
    // A default app was already initialized WITHOUT a database URL (e.g. by
    // a route that only needed auth before this module gained RTDB access).
    // App options are immutable, so create a dedicated named app with the
    // URL instead of reusing the URL-less one.
    cachedApp = initializeApp(config, 'apex-admin-rtdb');
  } else {
    cachedApp = initializeApp(config);
  }
  return cachedApp;
}

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

/**
 * Server-side RTDB access via the Admin SDK (service-account credentials).
 *
 * Unlike readRTDB/writeRTDB (which act as a specific Firebase user), this
 * talks to RTDB as the project's service account and is therefore NOT
 * subject to the database rules — the right tool for webhook handlers and
 * background jobs that must update records regardless of who called in.
 */
export function getAdminDb(): Database {
  if (cachedDb) return cachedDb;
  cachedDb = getDatabase(getAdminApp());
  return cachedDb;
}
