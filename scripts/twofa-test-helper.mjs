// Dev utility (not committed): inspect/update the demo account's 2FA state.
// Usage:
//   node scripts/twofa-test-helper.mjs get
//   node scripts/twofa-test-helper.mjs set-pin 1234
//   node scripts/twofa-test-helper.mjs clear
//   node scripts/twofa-test-helper.mjs mint-token http://localhost:3000
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { createHash, randomBytes } from 'crypto';

const env = process.env;
const key = (env.FIREBASE_PRIVATE_KEY || '').trim().replace(/\\n/g, '\n');
const app = initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID?.trim(),
    clientEmail: env.FIREBASE_CLIENT_EMAIL?.trim(),
    privateKey: key,
  }),
  databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
});
const auth = getAuth(app);
const db = getDatabase(app);

const DEMO_EMAIL = 'demo@apex.demo';
const RESET_PATH = 'twoFAPinResets';
const TOKEN_INDEX_PATH = 'twoFAPinResetTokenIndex';

// Same encoding as browser hashPin() AND src/lib/twofa-pin-reset.ts (hex).
function hashPin(pin) {
  return createHash('sha256').update(pin + 'apex-vault-2fa-salt').digest('hex');
}

const [, , cmd, arg] = process.argv;
const user = await auth.getUserByEmail(DEMO_EMAIL);
const profileRef = db.ref('users/' + user.uid);

if (cmd === 'get') {
  const snap = await profileRef.get();
  const p = snap.val() || {};
  console.log(JSON.stringify({ uid: user.uid, emailVerified: user.emailVerified, twoFAEnabled: p.twoFAEnabled ?? null, hasPin: Boolean(p.pin2FA), pin2FA: p.pin2FA ? p.pin2FA.slice(0, 12) + '…' : null, role: p.role }, null, 2));
} else if (cmd === 'set-pin') {
  await profileRef.update({ twoFAEnabled: true, pin2FA: hashPin(arg) });
  console.log('2FA enabled for', DEMO_EMAIL, 'with PIN', arg);
} else if (cmd === 'clear') {
  await profileRef.update({ twoFAEnabled: null, pin2FA: null });
  await db.ref(RESET_PATH + '/' + user.uid).remove();
  const idx = await db.ref(TOKEN_INDEX_PATH).get();
  const updates = {};
  for (const [h, uid] of Object.entries(idx.val() || {})) if (uid === user.uid) updates[TOKEN_INDEX_PATH + '/' + h] = null;
  if (Object.keys(updates).length) await db.ref().update(updates);
  console.log('2FA + reset records cleared for', DEMO_EMAIL);
} else if (cmd === 'mint-token') {
  // Mirrors request-2fa-pin-reset: replace any existing record, write index.
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const record = { tokenHash, expiresAt: now + 60 * 60 * 1000, requestedAt: now, usedAt: null };
  const existing = (await db.ref(RESET_PATH + '/' + user.uid).get()).val();
  const updates = {
    [RESET_PATH + '/' + user.uid]: record,
    [TOKEN_INDEX_PATH + '/' + tokenHash]: user.uid,
  };
  if (existing?.tokenHash) updates[TOKEN_INDEX_PATH + '/' + existing.tokenHash] = null;
  await db.ref().update(updates);
  const base = (arg || 'http://localhost:3000').replace(/\/+$/, '');
  console.log(base + '/auth/reset-2fa-pin?token=' + encodeURIComponent(token));
} else {
  console.error('Unknown command:', cmd);
  process.exit(1);
}

// firebase-admin/database keeps a websocket open — the process never exits
// on its own, so leave explicitly once the work above is done.
process.exit(0);
