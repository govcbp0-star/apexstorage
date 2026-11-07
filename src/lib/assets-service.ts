import { auth } from './firebase';

export interface AssetRecord {
  id: string;
  ref: string;
  type: string;
  weight: number;
  status: string;
  vaultLocation: string;
  owner: string;
  userId: string;
  integrityVerified?: boolean;
  createdAt?: string;
}

export async function addAsset(data: Omit<AssetRecord, 'id' | 'createdAt'>): Promise<string> {
  const result = await adminAssetRequest({ operation: 'create', ...data });
  if (!result.id) throw new Error('The asset was created without a reference.');
  return result.id;
}

export async function updateAsset(id: string, fields: Partial<AssetRecord>): Promise<void> {
  await adminAssetRequest({ operation: 'update', id, ...fields });
}

export async function deleteAsset(id: string): Promise<void> {
  await adminAssetRequest({ operation: 'delete', id });
}

async function adminAssetRequest(body: Record<string, unknown>): Promise<{ id?: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in as an administrator.');
  const token = await user.getIdToken();
  const response = await fetch('/api/admin/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recordType: 'asset', ...body }),
  });
  const result = await response.json().catch(() => ({})) as { id?: string; error?: string };
  if (!response.ok) throw new Error(result.error || 'The admin asset update failed.');
  return result;
}
