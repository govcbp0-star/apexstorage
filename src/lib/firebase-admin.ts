import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { ref, get } from 'firebase/database';
import { db } from './firebase';

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

  // Strategy 3: Client SDK (last resort — needs auth context, which server doesn't have)
  try {
    const snap = await Promise.race([
      get(ref(db, path)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    return snap.exists() ? snap.val() : null;
  } catch {
    return null;
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

let cachedAuth: Auth | null = null;

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

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const privateKey = normalizePrivateKey();
  if (!isAdminConfigured()) {
    throw new Error(
      'Firebase Admin SDK is not configured correctly. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and a valid FIREBASE_PRIVATE_KEY PEM.'
    );
  }

  const app: App = getApps().length
    ? getApps()[0]!
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!.trim(),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!.trim(),
          // The private key arrives with literal \n escapes — restore real newlines
          privateKey: privateKey!,
        }),
      });

  cachedAuth = getAuth(app);
  return cachedAuth;
}
