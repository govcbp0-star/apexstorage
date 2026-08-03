import { ref, push, set, get, remove, update, onValue, off } from 'firebase/database';
import { db } from './firebase';

export interface VaultRequest {
  id: string;
  userName: string;
  userId: string;
  userEmail: string;
  location: string;
  quantity: number;
  storageType: string; // allocated | pooled
  shippingAddress: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  notes: string;
  status: string; // pending | approved | rejected
  date: string;
  createdAt: string;
}

const VAULT_REQUESTS_PATH = 'vaultRequests';

/** Save a new vault request to RTDB */
export async function submitVaultRequest(data: {
  userName: string;
  userId: string;
  userEmail: string;
  location: string;
  quantity: number;
  storageType: string;
  shippingAddress: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  notes: string;
}): Promise<string> {
  const requestsRef = ref(db, VAULT_REQUESTS_PATH);
  const newRef = push(requestsRef);
  const id = newRef.key || Date.now().toString();
  const now = new Date();
  const request: Omit<VaultRequest, 'id'> & { id: string } = {
    id,
    userName: data.userName.trim(),
    userId: data.userId.trim(),
    userEmail: data.userEmail.trim(),
    location: data.location.trim(),
    quantity: data.quantity,
    storageType: data.storageType.trim(),
    shippingAddress: data.shippingAddress.trim(),
    city: data.city.trim(),
    state: data.state.trim(),
    postcode: data.postcode.trim(),
    country: data.country.trim(),
    notes: data.notes.trim(),
    status: 'pending',
    date: now.toISOString().split('T')[0],
    createdAt: now.toISOString(),
  };
  await set(newRef, request);
  return id;
}

/** Fetch all vault requests from RTDB */
export async function fetchVaultRequests(): Promise<VaultRequest[]> {
  const requestsRef = ref(db, VAULT_REQUESTS_PATH);
  const snapshot = await get(requestsRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as VaultRequest[];
}

/** Update a vault request's status (approve/reject) */
export async function updateVaultRequestStatus(id: string, status: string): Promise<void> {
  const reqRef = ref(db, `${VAULT_REQUESTS_PATH}/${id}`);
  await update(reqRef, { status });
}

/** Delete a vault request */
export async function deleteVaultRequest(id: string): Promise<void> {
  const reqRef = ref(db, `${VAULT_REQUESTS_PATH}/${id}`);
  await remove(reqRef);
}

/** Subscribe to real-time vault requests updates */
export function subscribeToVaultRequests(callback: (requests: VaultRequest[]) => void): () => void {
  const requestsRef = ref(db, VAULT_REQUESTS_PATH);
  const handler = onValue(requestsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const requests = Object.values(data) as VaultRequest[];
    // Sort by date descending (newest first)
    requests.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      // Secondary sort by createdAt if available
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    callback(requests);
  });
  return () => off(requestsRef, 'value', handler);
}
