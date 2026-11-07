import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { assetIntegrityFields, signRecordIntegrity } from '@/lib/record-integrity';
import { RequestAuthError, verifyAdminRequest } from '@/lib/server-auth';

type RecordType = 'asset' | 'order' | 'shipment';

export async function POST(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const body = await request.json().catch(() => ({}));
    const recordType = body?.recordType as RecordType;
    const operation = typeof body?.operation === 'string' ? body.operation : '';
    const id = typeof body?.id === 'string' ? body.id.trim() : '';

    if (!['asset', 'order', 'shipment'].includes(recordType)) {
      return NextResponse.json({ error: 'The record reference is invalid.' }, { status: 400 });
    }

    const database = getAdminDb();
    if (recordType === 'asset' && operation === 'create') {
      const asset = normalizeAsset(body);
      if (!asset) return NextResponse.json({ error: 'Enter valid asset details.' }, { status: 400 });
      const userId = asset.userId;
      if (userId && !(await database.ref(`users/${userId}`).once('value')).exists()) {
        return NextResponse.json({ error: 'Choose an existing asset owner.' }, { status: 400 });
      }
      const assetRef = database.ref('assets').push();
      if (!assetRef.key) throw new Error('Could not allocate an asset reference.');
      const createdAt = new Date().toISOString();
      const record = { ...asset, id: assetRef.key, createdAt, recordVersion: 1 };
      await assetRef.set({
        ...record,
        recordIntegrity: signRecordIntegrity('asset', assetIntegrityFields(record)),
      });
      return NextResponse.json({ success: true, id: assetRef.key }, { status: 201 });
    }

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      return NextResponse.json({ error: 'The record reference is invalid.' }, { status: 400 });
    }
    const collection = recordType === 'asset' ? 'assets' : recordType === 'order' ? 'orders' : 'shipments';
    const recordRef = database.ref(`${collection}/${id}`);
    const snapshot = await recordRef.once('value');
    const record = snapshot.val() as { assetId?: string } | null;
    if (!record) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });

    if (operation === 'delete') {
      await recordRef.remove();
      return NextResponse.json({ success: true });
    }

    if (recordType === 'asset' && operation === 'update') {
      const asset = normalizeAsset(body, true);
      if (!asset) return NextResponse.json({ error: 'Enter valid asset details.' }, { status: 400 });
      if (asset.userId && !(await database.ref(`users/${asset.userId}`).once('value')).exists()) {
        return NextResponse.json({ error: 'Choose an existing asset owner.' }, { status: 400 });
      }
      const updatedRecord = { ...record, ...asset, id, recordVersion: 1 };
      await recordRef.update({
        ...asset,
        recordVersion: 1,
        recordIntegrity: signRecordIntegrity('asset', assetIntegrityFields(updatedRecord)),
      });
      return NextResponse.json({ success: true });
    }

    if (recordType === 'asset') {
      return NextResponse.json({ error: 'Choose a valid asset operation.' }, { status: 400 });
    }

    if (operation !== 'update-status' || typeof body?.status !== 'string') {
      return NextResponse.json({ error: 'Choose a valid record operation.' }, { status: 400 });
    }

    const status = body.status.trim().toLowerCase();
    const validStatuses = recordType === 'order'
      ? new Set(['pending', 'processing', 'completed', 'cancelled'])
      : new Set(['pending', 'approved', 'rejected', 'shipped']);
    if (!validStatuses.has(status)) {
      return NextResponse.json({ error: 'That status is not allowed.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      [`${collection}/${id}/status`]: status,
      [`${collection}/${id}/updatedAt`]: new Date().toISOString(),
    };
    if (recordType === 'shipment' && ['approved', 'rejected', 'shipped'].includes(status)) {
      const assetStatus = status === 'approved' ? 'in-transit' : status === 'shipped' ? 'shipped' : 'active';
      for (const assetId of String(record.assetId || '').split(',').map((value) => value.trim()).filter(Boolean)) {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(assetId)) continue;
        const assetSnapshot = await database.ref(`assets/${assetId}`).once('value');
        const asset = assetSnapshot.val() as Record<string, unknown> | null;
        if (!asset) continue;
        const updatedAsset = { ...asset, id: typeof asset.id === 'string' ? asset.id : assetId, status: assetStatus };
        updates[`assets/${assetId}/status`] = assetStatus;
        updates[`assets/${assetId}/recordVersion`] = 1;
        updates[`assets/${assetId}/recordIntegrity`] = signRecordIntegrity('asset', assetIntegrityFields(updatedAsset));
      }
    }
    await database.ref().update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API /admin/records] Record update failed:', error);
    return NextResponse.json({ error: 'Could not update the record.' }, { status: 500 });
  }
}

function normalizeAsset(body: Record<string, unknown>, partial = false): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  const fields = ['ref', 'type', 'weight', 'status', 'vaultLocation', 'owner', 'userId'] as const;
  for (const field of fields) {
    if (partial && body[field] === undefined) continue;
    const value = body[field];
    if (field === 'weight') {
      const weight = Number(value);
      if (!Number.isFinite(weight) || weight <= 0) return null;
      result.weight = weight;
      continue;
    }
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (field === 'type' && !['bar', 'coin', 'jewellery'].includes(normalized.toLowerCase())) return null;
    if (field === 'status' && !['active', 'pending', 'in-transit', 'shipped'].includes(normalized.toLowerCase())) return null;
    if (field !== 'userId' && !normalized) return null;
    result[field] = field === 'type' || field === 'status' ? normalized.toLowerCase() : normalized;
  }
  return Object.keys(result).length > 0 ? result : null;
}
