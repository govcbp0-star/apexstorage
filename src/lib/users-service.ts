import { ref, get, update, remove, onValue, off } from 'firebase/database';
import { db } from './firebase';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'admin';
  status: string;
  vaultLocation: string;
  joined: string;
  createdAt?: string;
}

const USERS_PATH = 'users';

/** Fetch all users from RTDB */
export async function fetchUsers(): Promise<UserRecord[]> {
  const usersRef = ref(db, USERS_PATH);
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.entries(data).map(([uid, profile]: [string, any]) => ({
    id: uid,
    name: profile.name || '',
    email: profile.email || '',
    role: profile.role || 'client',
    status: profile.status || 'active',
    vaultLocation: profile.vaultLocation || '',
    joined: profile.createdAt ? new Date(profile.createdAt).toISOString().split('T')[0] : '',
    createdAt: profile.createdAt || '',
  }));
}

/** Update a user's profile in RTDB */
export async function updateUser(uid: string, fields: Partial<UserRecord>): Promise<void> {
  const userRef = ref(db, `${USERS_PATH}/${uid}`);
  const updateData: Record<string, string> = {};
  if (fields.name !== undefined) updateData.name = fields.name;
  if (fields.email !== undefined) updateData.email = fields.email;
  if (fields.role !== undefined) updateData.role = fields.role;
  if (fields.status !== undefined) updateData.status = fields.status;
  if (fields.vaultLocation !== undefined) updateData.vaultLocation = fields.vaultLocation;
  await update(userRef, updateData);
}

/** Delete a user from RTDB */
export async function deleteUser(uid: string): Promise<void> {
  const userRef = ref(db, `${USERS_PATH}/${uid}`);
  await remove(userRef);
}

/** Subscribe to real-time users updates */
export function subscribeToUsers(callback: (users: UserRecord[]) => void, onError?: (error: Error & { code?: string }) => void): () => void {
  const usersRef = ref(db, USERS_PATH);
  const handler = onValue(usersRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const users = Object.entries(data).map(([uid, profile]: [string, any]) => ({
      id: uid,
      name: profile.name || '',
      email: profile.email || '',
      role: (profile.role || 'client') as 'client' | 'admin',
      status: profile.status || 'active',
      vaultLocation: profile.vaultLocation || '',
      joined: profile.createdAt ? new Date(profile.createdAt).toISOString().split('T')[0] : '',
      createdAt: profile.createdAt || '',
    }));
    // Sort by creation date descending (newest first)
    users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(users);
  }, (error) => {
    const dbError = error as Error & { code?: string };
    console.warn('[users-service] RTDB subscription error:', dbError.code, dbError.message);
    if (onError) onError(dbError);
  });
  return () => off(usersRef, 'value', handler);
}
