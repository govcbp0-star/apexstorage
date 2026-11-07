import { auth } from './firebase';

export interface Shipment {
  id: string;
  userName: string;
  userId: string;
  userEmail: string;
  assetType?: string;
  assetRef: string;
  assetId: string;
  shippingAmount: string;
  partialGrams: number;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryCountry: string;
  weight: number;
  shipmentFee?: number;
  vaultLocation?: string;
  goldPrice?: number;
  goldValue?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
  notificationEmailSent?: boolean;
  emailSentAt?: string;
  status: string;
  date: string;
  createdAt: string;
}

export async function updateShipmentStatus(id: string, status: string): Promise<void> {
  await adminRecordRequest({ recordType: 'shipment', operation: 'update-status', id, status });
}

export async function deleteShipment(id: string): Promise<void> {
  await adminRecordRequest({ recordType: 'shipment', operation: 'delete', id });
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
