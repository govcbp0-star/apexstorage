import { ref, get } from 'firebase/database';
import { db } from './firebase';

// Firebase Admin SDK is NOT available in this environment (no service account credentials).
// Instead, we use the Firebase REST API to read data server-side, with optional ID token auth.
// This bypasses the need for a service account while still respecting RTDB security rules.

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
