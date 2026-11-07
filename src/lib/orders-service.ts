import { auth } from './firebase';

export interface Order {
  id: string;
  userName: string;
  userId: string;
  userEmail: string;
  type: string;
  productType: string;
  quantityGrams: number;
  quantityOz: number;
  vault: string;
  estimatedTotal: number;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
  date: string;
  createdAt: string;
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  await adminRecordRequest({ recordType: 'order', operation: 'update-status', id, status });
}

export async function deleteOrder(id: string): Promise<void> {
  await adminRecordRequest({ recordType: 'order', operation: 'delete', id });
}

async function adminRecordRequest(body: Record<string, unknown>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in as an administrator.');
  const token = await user.getIdToken();
  const response = await fetch('/api/admin/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || 'The admin update failed.');
}
