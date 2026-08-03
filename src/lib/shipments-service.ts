import { ref, push, set, get, update, remove, onValue, off } from 'firebase/database';
import { db } from './firebase';

export interface Shipment {
  id: string;
  userName: string;
  userId: string;
  userEmail: string;
  assetRef: string;
  assetId: string;
  shippingAmount: string; // full | partial
  partialGrams: number;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryCountry: string;
  weight: number;
  status: string; // pending | approved | rejected | shipped
  date: string;
  createdAt: string;
}

const SHIPMENTS_PATH = 'shipments';

/** Submit a new shipment request to RTDB */
export async function submitShipment(data: {
  userName: string;
  userId: string;
  userEmail: string;
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
}): Promise<string> {
  const shipmentsRef = ref(db, SHIPMENTS_PATH);
  const newRef = push(shipmentsRef);
  const id = newRef.key || Date.now().toString();
  const now = new Date();
  const shipment: Omit<Shipment, 'id'> & { id: string } = {
    id,
    userName: data.userName.trim(),
    userId: data.userId.trim(),
    userEmail: data.userEmail.trim(),
    assetRef: data.assetRef.trim(),
    assetId: data.assetId.trim(),
    shippingAmount: data.shippingAmount,
    partialGrams: data.partialGrams,
    deliveryName: data.deliveryName.trim(),
    deliveryPhone: data.deliveryPhone.trim(),
    deliveryAddress: data.deliveryAddress.trim(),
    deliveryCity: data.deliveryCity.trim(),
    deliveryPostcode: data.deliveryPostcode.trim(),
    deliveryCountry: data.deliveryCountry.trim(),
    weight: data.weight,
    status: 'pending',
    date: now.toISOString().split('T')[0],
    createdAt: now.toISOString(),
  };
  await set(newRef, shipment);
  return id;
}

/** Fetch all shipments from RTDB */
export async function fetchShipments(): Promise<Shipment[]> {
  const shipmentsRef = ref(db, SHIPMENTS_PATH);
  const snapshot = await get(shipmentsRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as Shipment[];
}

/** Update a shipment's status */
export async function updateShipmentStatus(id: string, status: string): Promise<void> {
  const shipmentRef = ref(db, `${SHIPMENTS_PATH}/${id}`);
  await update(shipmentRef, { status });
}

/** Delete a shipment */
export async function deleteShipment(id: string): Promise<void> {
  const shipmentRef = ref(db, `${SHIPMENTS_PATH}/${id}`);
  await remove(shipmentRef);
}

/** Subscribe to real-time shipments updates */
export function subscribeToShipments(callback: (shipments: Shipment[]) => void, onError?: (error: Error) => void): () => void {
  const shipmentsRef = ref(db, SHIPMENTS_PATH);
  const handler = onValue(shipmentsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const shipments = Object.values(data) as Shipment[];
    shipments.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(shipments);
  }, (error) => {
    console.warn('[shipments-service] RTDB subscription error:', error.code, error.message);
    if (onError) onError(error);
  });
  return () => off(shipmentsRef, 'value', handler);
}
