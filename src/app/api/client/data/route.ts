import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { assetIntegrityFields, verifyRecordIntegrity } from '@/lib/record-integrity';
import { RequestAuthError, verifyRequestUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyRequestUser(request);
    const database = getAdminDb();
    const paths = ['assets', 'orders', 'shipments', 'vaultRequests', 'transactions'];
    const snapshots = await Promise.all(paths.map((path) => database.ref(path).once('value')));
    const data = Object.fromEntries(paths.map((path, index) => [path, snapshots[index].val() || {}]));
    const email = decoded.email?.toLowerCase() || '';

    const belongsToUser = (record: Record<string, unknown>) =>
      record.userId === decoded.uid ||
      (email && typeof record.userEmail === 'string' && record.userEmail.toLowerCase() === email) ||
      (email && typeof record.owner === 'string' && record.owner.toLowerCase() === email);
    const filterRecords = (records: unknown, strictUid = false): Record<string, unknown>[] =>
      Object.entries(records as Record<string, Record<string, unknown>>)
        .filter(([, record]) => strictUid ? record.userId === decoded.uid : belongsToUser(record))
        .map<Record<string, unknown>>(([id, record]) => ({ ...record, id: typeof record.id === 'string' ? record.id : id }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    const assets = filterRecords(data.assets, true).map((asset) => ({
      ...asset,
      integrityVerified: asset.recordVersion === 1 &&
        verifyRecordIntegrity('asset', assetIntegrityFields(asset), asset.recordIntegrity),
    }));

    return NextResponse.json({
      assets,
      orders: filterRecords(data.orders, true),
      shipments: filterRecords(data.shipments, true),
      vaultRequests: filterRecords(data.vaultRequests),
      transactions: filterRecords(data.transactions, true),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API /client/data] Failed to load client data:', error);
    return NextResponse.json({ error: 'Could not load dashboard data.' }, { status: 500 });
  }
}
