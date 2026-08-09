#!/usr/bin/env node
// Dev utility — creates/refreshes the demo client account in Firebase Auth and
// seeds RTDB with a realistic history (assets / orders / transactions /
// shipments / vault-requests) so the crypto-checkout, shipment-fees, client
// dashboard, and admin approvals UI can be audited end-to-end.
//
//   npm run seed:demo          # create/refresh demo user + seed data
//   npm run seed:demo:clean    # wipe ONLY the demo user's records (no re-seed)
//   npm run seed:demo:reseed   # wipe demo records to a known-good empty state,
//                              # then seed a fresh history (same as the default
//                              # seed, with timestamps relative to now)
//
// Every command is idempotent and only ever touches records owned by
// demo@apex.demo. The wipe is ownership-based (userId / userEmail / owner),
// so it also removes records created during manual testing via push-generated
// keys — not just the deterministic demo_* keys — guaranteeing a clean slate.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Minimal .env loader (dotenv isn't a top-level dep) ─────────────
function loadEnv(file, override) {
  try {
    const txt = readFileSync(join(root, file), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let val = m[2].trim();
      if (val.length >= 2 && ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))) {
        val = val.slice(1, -1);
      }
      if (override || !(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch { /* missing file is fine */ }
}
loadEnv('.env', false);
loadEnv('.env.local', true);

const DEMO_EMAIL = 'demo@apex.demo';
const DEMO_PASSWORD = 'ApexDemo#2026';
const DEMO_NAME = 'Demo Client';

// Collections the app reads; every record owned by the demo user lives here.
const COLLECTIONS = ['assets', 'orders', 'transactions', 'shipments', 'vaultRequests'];

// ── CLI ─────────────────────────────────────────────────────────────
const subcommand = process.argv[2] || (process.argv.includes('--clean') ? 'clean' : 'seed');
if (!['seed', 'clean', 'reseed'].includes(subcommand)) {
  console.error(`Unknown command "${subcommand}". Use: seed | clean | reseed`);
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

if (!projectId || !clientEmail || !privateKeyRaw || !databaseURL) {
  console.error('Missing Firebase Admin env vars (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY / NEXT_PUBLIC_FIREBASE_DATABASE_URL).');
  process.exit(1);
}

const privateKey = privateKeyRaw.trim().replace(/\\n/g, '\n');
const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  databaseURL,
});
const auth = getAuth(app);
const db = getDatabase(app);

const now = new Date();
const iso = now.toISOString();
const day = iso.split('T')[0];
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();
const dayAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString().split('T')[0];

// ── Demo user ───────────────────────────────────────────────────────
async function findDemoUser() {
  try {
    return await auth.getUserByEmail(DEMO_EMAIL);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    return null;
  }
}

async function ensureDemoUser() {
  let user = await findDemoUser();
  if (!user) {
    user = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      emailVerified: true,
      displayName: DEMO_NAME,
    });
    console.log(`[user] created: ${user.uid}`);
  } else {
    console.log(`[user] exists:  ${user.uid}`);
  }
  await auth.updateUser(user.uid, { emailVerified: true, password: DEMO_PASSWORD, displayName: DEMO_NAME });
  return user;
}

// ── Wipe (known-good empty state) ───────────────────────────────────
function belongsToDemo(record, uid) {
  if (!record || typeof record !== 'object') return false;
  return (uid && record.userId === uid)
    || record.userEmail === DEMO_EMAIL
    || record.owner === DEMO_EMAIL;
}

async function wipeDemoData(uid) {
  const removed = {};
  for (const coll of COLLECTIONS) {
    const snap = await db.ref(coll).get();
    if (!snap.exists()) continue;
    const data = snap.val();
    const keys = Object.keys(data).filter((key) =>
      key.startsWith('demo_') || belongsToDemo(data[key], uid)
    );
    for (const key of keys) {
      await db.ref(`${coll}/${key}`).remove().catch(() => {});
    }
    if (keys.length) removed[coll] = keys.length;
  }
  if (uid) {
    const userSnap = await db.ref(`users/${uid}`).get();
    if (userSnap.exists()) {
      await db.ref(`users/${uid}`).remove().catch(() => {});
      removed['users'] = 1;
    }
  }
  return removed;
}

// ── Seed (fresh, deterministic history) ─────────────────────────────
async function seedData(uid) {
  // Profile
  await db.ref(`users/${uid}`).set({
    name: DEMO_NAME,
    email: DEMO_EMAIL,
    role: 'client',
    status: 'active',
    vaultLocation: 'Zurich A',
    photoURL: null,
    createdAt: daysAgo(60),
  });

  // Assets — bar/Zurich totals 1500g so the shipment wizard's 1000g floor passes
  const assets = [
    { id: 'demo_assets_1', ref: 'DEMO-BAR-1000-001', type: 'bar', weight: 1000, status: 'active', vaultLocation: 'Zurich' },
    { id: 'demo_assets_2', ref: 'DEMO-BAR-0500-002', type: 'bar', weight: 500, status: 'active', vaultLocation: 'Zurich' },
    { id: 'demo_assets_3', ref: 'DEMO-COIN-0031-003', type: 'coin', weight: 31.1, status: 'active', vaultLocation: 'London' },
  ];
  for (const a of assets) {
    await db.ref(`assets/${a.id}`).set({
      id: a.id, ref: a.ref, type: a.type, weight: a.weight, status: a.status,
      vaultLocation: a.vaultLocation, owner: DEMO_EMAIL, userId: uid,
      createdAt: daysAgo(45),
    });
  }

  // Orders
  const orders = [
    {
      id: 'demo_orders_1', type: 'Buy Gold', productType: 'bar', quantityGrams: 1000, quantityOz: 32.15,
      vault: 'zurich', estimatedTotal: 96500, status: 'completed', paymentMethod: 'crypto',
      paymentStatus: 'confirmed', date: dayAgo(40), createdAt: daysAgo(40),
    },
    {
      id: 'demo_orders_2', type: 'Buy Gold', productType: 'coin', quantityGrams: 31.1, quantityOz: 1,
      vault: 'london', estimatedTotal: 2950, status: 'processing', paymentMethod: 'crypto',
      paymentStatus: 'confirmed', date: dayAgo(12), createdAt: daysAgo(12),
    },
    {
      id: 'demo_orders_3', type: 'Buy Gold', productType: 'bar', quantityGrams: 500, quantityOz: 16.08,
      vault: 'zurich', estimatedTotal: 48250, status: 'pending', paymentMethod: 'crypto',
      paymentStatus: 'pending', date: day, createdAt: iso,
    },
    {
      id: 'demo_orders_4', type: 'Buy Gold', productType: 'bar', quantityGrams: 250, quantityOz: 8.04,
      vault: 'zurich', estimatedTotal: 24125, status: 'cancelled', paymentMethod: 'crypto',
      paymentStatus: 'failed', date: dayAgo(20), createdAt: daysAgo(20),
    },
    {
      id: 'demo_orders_5', type: 'Sell Gold', productType: 'bar', quantityGrams: 250, quantityOz: 8.04,
      vault: 'zurich', estimatedTotal: 24125, status: 'pending', paymentMethod: 'bank',
      paymentStatus: 'pending', date: dayAgo(3), createdAt: daysAgo(3),
    },
  ];
  for (const o of orders) {
    await db.ref(`orders/${o.id}`).set({
      id: o.id, userName: DEMO_NAME, userId: uid, userEmail: DEMO_EMAIL,
      type: o.type, productType: o.productType, quantityGrams: o.quantityGrams, quantityOz: o.quantityOz,
      vault: o.vault, estimatedTotal: o.estimatedTotal, status: o.status,
      paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, date: o.date, createdAt: o.createdAt,
    });
  }

  // Transactions
  const txns = [
    {
      id: 'demo_transactions_1', type: 'gold_purchase', description: 'Buy Gold Bar - 1000g',
      amount: 96500, currency: 'usd', cryptoCurrency: 'USDT', cryptoAmount: 96500,
      paymentId: 'demo-pay-001', paymentStatus: 'confirmed', orderId: 'demo_orders_1',
      date: dayAgo(40), createdAt: daysAgo(40), updatedAt: daysAgo(39),
    },
    {
      id: 'demo_transactions_2', type: 'gold_purchase', description: 'Buy Gold Coin - 31.1g',
      amount: 2950, currency: 'usd', cryptoCurrency: 'BTC', cryptoAmount: 0.031,
      paymentId: 'demo-pay-002', paymentStatus: 'confirmed', orderId: 'demo_orders_2',
      date: dayAgo(12), createdAt: daysAgo(12), updatedAt: daysAgo(11),
    },
    {
      id: 'demo_transactions_3', type: 'shipment', description: 'Shipment: London, United Kingdom',
      amount: 242, currency: 'usd', cryptoCurrency: 'ETH', cryptoAmount: 0.06,
      paymentId: 'demo-pay-003', paymentStatus: 'confirmed', shipmentId: 'demo_shipments_1',
      date: dayAgo(6), createdAt: daysAgo(6), updatedAt: daysAgo(5),
    },
    {
      id: 'demo_transactions_4', type: 'gold_purchase', description: 'Refund — Buy Gold Bar - 250g',
      amount: 24125, currency: 'usd', cryptoCurrency: 'USDT', cryptoAmount: 24125,
      paymentId: 'demo-pay-004', paymentStatus: 'failed', orderId: 'demo_orders_4',
      date: dayAgo(20), createdAt: daysAgo(20), updatedAt: daysAgo(19),
    },
  ];
  for (const t of txns) {
    const rec = {
      id: t.id, userId: uid, userEmail: DEMO_EMAIL, userName: DEMO_NAME,
      type: t.type, description: t.description, amount: t.amount, currency: t.currency,
      cryptoCurrency: t.cryptoCurrency, cryptoAmount: t.cryptoAmount, paymentId: t.paymentId,
      paymentStatus: t.paymentStatus,
      createdAt: t.createdAt, updatedAt: t.updatedAt,
      metadata: { orderId: t.orderId || t.shipmentId },
    };
    // RTDB rejects undefined values — only set the link that exists
    if (t.orderId) rec.orderId = t.orderId;
    if (t.shipmentId) rec.shipmentId = t.shipmentId;
    await db.ref(`transactions/${t.id}`).set(rec);
  }

  // Shipment (completed example)
  await db.ref('shipments/demo_shipments_1').set({
    id: 'demo_shipments_1', userName: DEMO_NAME, userId: uid, userEmail: DEMO_EMAIL,
    assetRef: 'DEMO-COIN-0031-003', assetId: 'demo_assets_3',
    shippingAmount: 'ship_full', partialGrams: 0,
    deliveryName: DEMO_NAME, deliveryPhone: '+441234567890',
    deliveryAddress: '1 Gold Lane', deliveryCity: 'London', deliveryPostcode: 'EC1A 1BB',
    deliveryCountry: 'United Kingdom', weight: 31.1, shipmentFee: 242,
    paymentMethod: 'crypto', paymentStatus: 'confirmed', status: 'shipped',
    date: dayAgo(6), createdAt: daysAgo(6),
  });

  // Shipment (pending example — awaiting admin approval)
  await db.ref('shipments/demo_shipments_2').set({
    id: 'demo_shipments_2', userName: DEMO_NAME, userId: uid, userEmail: DEMO_EMAIL,
    assetRef: 'DEMO-BAR-1000-001', assetId: 'demo_assets_1',
    shippingAmount: 'ship_partial', partialGrams: 500,
    deliveryName: DEMO_NAME, deliveryPhone: '+441234567890',
    deliveryAddress: '2 Gold Lane', deliveryCity: 'London', deliveryPostcode: 'EC1A 1BB',
    deliveryCountry: 'United Kingdom', weight: 500, shipmentFee: 121,
    paymentMethod: 'crypto', paymentStatus: 'confirmed', status: 'pending',
    date: dayAgo(2), createdAt: daysAgo(2),
  });

  // Vault request (approved example)
  await db.ref('vaultRequests/demo_vaultRequests_1').set({
    id: 'demo_vaultRequests_1', userName: DEMO_NAME, userId: uid, userEmail: DEMO_EMAIL,
    location: 'Zurich', quantity: 2500, storageType: 'allocated',
    shippingAddress: '1 Gold Lane', city: 'London', state: '', postcode: 'EC1A 1BB',
    country: 'United Kingdom', notes: 'Allocated vault storage demo request.',
    status: 'approved', date: dayAgo(30), createdAt: daysAgo(30),
  });
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  if (subcommand === 'clean' || subcommand === 'reseed') {
    const user = await findDemoUser();
    const uid = user ? user.uid : null;
    const removed = await wipeDemoData(uid);
    const detail = Object.entries(removed)
      .map(([coll, n]) => `${coll}: ${n}`)
      .join(', ') || 'nothing to remove';
    console.log(`[wipe] removed demo records (${detail})`);
    if (subcommand === 'clean') process.exit(0);
  }

  const user = await ensureDemoUser();
  await seedData(user.uid);

  console.log('─'.repeat(52));
  console.log('Demo account ready:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  uid:      ${user.uid}`);
  console.log('  seeded: 3 assets, 5 orders, 4 transactions, 2 shipments, 1 vault request');
  console.log(`  state:   ${subcommand === 'reseed' ? 'fresh reseed (history rebuilt from ' + daysAgo(60).split('T')[0] + ')' : 'seeded'}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[seed-demo] failed:', e.message);
  process.exit(1);
});
