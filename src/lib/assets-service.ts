import { ref, push, set, get, update, remove, onValue, off } from 'firebase/database';
import { db } from './firebase';

export interface AssetRecord {
  id: string;
  ref: string;
  type: string; // bar | coin | jewellery
  weight: number;
  status: string; // active | pending
  vaultLocation: string;
  owner: string;
  userId: string;
  createdAt?: string;
}

const ASSETS_PATH = 'assets';

/** Add a new asset to RTDB */
export async function addAsset(data: {
  ref: string;
  type: string;
  weight: number;
  status: string;
  vaultLocation: string;
  owner: string;
  userId: string;
}): Promise<string> {
  const assetsRef = ref(db, ASSETS_PATH);
  const newRef = push(assetsRef);
  const id = newRef.key || Date.now().toString();
  const asset: Omit<AssetRecord, 'id'> & { id: string } = {
    id,
    ref: data.ref.trim(),
    type: data.type.trim(),
    weight: data.weight,
    status: data.status.trim() || 'active',
    vaultLocation: data.vaultLocation.trim(),
    owner: data.owner.trim(),
    userId: data.userId.trim(),
    createdAt: new Date().toISOString(),
  };
  await set(newRef, asset);
  return id;
}

/** Update an asset in RTDB */
export async function updateAsset(id: string, fields: Partial<AssetRecord>): Promise<void> {
  const assetRef = ref(db, `${ASSETS_PATH}/${id}`);
  const updateData: Record<string, any> = {};
  if (fields.ref !== undefined) updateData.ref = fields.ref;
  if (fields.type !== undefined) updateData.type = fields.type;
  if (fields.weight !== undefined) updateData.weight = fields.weight;
  if (fields.status !== undefined) updateData.status = fields.status;
  if (fields.vaultLocation !== undefined) updateData.vaultLocation = fields.vaultLocation;
  if (fields.owner !== undefined) updateData.owner = fields.owner;
  if (fields.userId !== undefined) updateData.userId = fields.userId;
  await update(assetRef, updateData);
}

/** Delete an asset from RTDB */
export async function deleteAsset(id: string): Promise<void> {
  const assetRef = ref(db, `${ASSETS_PATH}/${id}`);
  await remove(assetRef);
}

/** Fetch all assets from RTDB */
export async function fetchAssets(): Promise<AssetRecord[]> {
  const assetsRef = ref(db, ASSETS_PATH);
  const snapshot = await get(assetsRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as AssetRecord[];
}

/** Subscribe to real-time assets updates */
export function subscribeToAssets(callback: (assets: AssetRecord[]) => void, onError?: (error: Error) => void): () => void {
  const assetsRef = ref(db, ASSETS_PATH);
  const handler = onValue(assetsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const assets = Object.values(data) as AssetRecord[];
    // Sort by creation date descending (newest first)
    assets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(assets);
  }, (error) => {
    console.warn('[assets-service] RTDB subscription error:', error.code, error.message);
    if (onError) onError(error);
  });
  return () => off(assetsRef, 'value', handler);
}
