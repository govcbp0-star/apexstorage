import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { assetIntegrityFields, verifyRecordIntegrity } from '@/lib/record-integrity';
import { RequestAuthError, verifyAdminRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const database = getAdminDb();
    const paths = ['users', 'vaultRequests', 'contactMessages', 'assets', 'orders', 'shipments', 'newsletter', 'transactions'];
    const snapshots = await Promise.all(paths.map((path) => database.ref(path).once('value')));
    const records = Object.fromEntries(paths.map((path, index) => [path, snapshots[index].val() || {}]));

    const users = Object.entries(records.users as Record<string, Record<string, unknown>>)
      .map(([id, profile]) => ({
        id,
        name: profile.name || '',
        email: profile.email || '',
        role: profile.role || 'client',
        status: profile.status || 'active',
        vaultLocation: profile.vaultLocation || '',
        joined: profile.createdAt ? new Date(String(profile.createdAt)).toISOString().split('T')[0] : '',
        createdAt: profile.createdAt || '',
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    const sortedValues = (data: unknown) => Object.values(data as Record<string, Record<string, unknown>>)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const withIds = (data: unknown): Record<string, unknown>[] => Object.entries(data as Record<string, Record<string, unknown>>)
      .map<Record<string, unknown>>(([id, value]) => ({ ...value, id: typeof value.id === 'string' ? value.id : id }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    const newsletterSubscribers = Object.entries(records.newsletter as Record<string, Record<string, unknown>>)
      .map(([id, subscriber]) => ({
        id,
        email: subscriber.email || '',
        subscribedAt: subscriber.subscribedAt || '',
        source: subscriber.source || 'website-footer',
      }))
      .filter((subscriber) => subscriber.email)
      .sort((a, b) => String(b.subscribedAt).localeCompare(String(a.subscribedAt)));

    const assets = withIds(records.assets).map((asset) => ({
      ...asset,
      integrityVerified: asset.recordVersion === 1 &&
        verifyRecordIntegrity('asset', assetIntegrityFields(asset), asset.recordIntegrity),
    }));

    return NextResponse.json({
      users,
      vaultRequests: sortedValues(records.vaultRequests),
      messages: sortedValues(records.contactMessages),
      assets,
      orders: withIds(records.orders),
      shipments: withIds(records.shipments),
      newsletterSubscribers,
      transactions: withIds(records.transactions),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API /admin/data] Failed to load admin data:', error);
    return NextResponse.json({ error: 'Could not load dashboard data.' }, { status: 500 });
  }
}
