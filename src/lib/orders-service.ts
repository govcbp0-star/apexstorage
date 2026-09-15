import { ref, push, set, get, update, remove, onValue, off } from 'firebase/database';
import { db } from './firebase';

export interface Order {
  id: string;
  userName: string;
  userId: string;
  userEmail: string;
  type: string; // Buy Gold | Sell Gold
  productType: string; // bar | coin
  quantityGrams: number;
  quantityOz: number;
  vault: string;
  estimatedTotal: number;
  status: string; // pending | processing | completed | cancelled
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
  date: string;
  createdAt: string;
}

const ORDERS_PATH = 'orders';

/** Submit a new order to RTDB */
export async function submitOrder(data: {
  userName: string;
  userId: string;
  userEmail: string;
  type: string;
  productType: string;
  quantityGrams: number;
  quantityOz: number;
  vault: string;
  estimatedTotal: number;
  paymentMethod?: string;
  paymentStatus?: string;
  orderId?: string;
}): Promise<string> {
  const ordersRef = ref(db, ORDERS_PATH);
  const newRef = data.orderId ? ref(db, `${ORDERS_PATH}/${data.orderId}`) : push(ordersRef);
  const id = data.orderId || newRef.key || Date.now().toString();
  const now = new Date();
  const order: Omit<Order, 'id'> & { id: string } = {
    id,
    userName: data.userName.trim(),
    userId: data.userId.trim(),
    userEmail: data.userEmail.trim(),
    type: data.type.trim(),
    productType: data.productType.trim(),
    quantityGrams: data.quantityGrams,
    quantityOz: data.quantityOz,
    vault: data.vault.trim(),
    estimatedTotal: data.estimatedTotal,
    status: 'pending',
    paymentMethod: data.paymentMethod,
    paymentStatus: data.paymentStatus,
    date: now.toISOString().split('T')[0],
    createdAt: now.toISOString(),
  };
  await set(newRef, order);
  return id;
}

/** Fetch all orders from RTDB */
export async function fetchOrders(): Promise<Order[]> {
  const ordersRef = ref(db, ORDERS_PATH);
  const snapshot = await get(ordersRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as Order[];
}

/** Update an order's status */
export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const orderRef = ref(db, `${ORDERS_PATH}/${id}`);
  await update(orderRef, { status });
}

/** Delete an order */
export async function deleteOrder(id: string): Promise<void> {
  const orderRef = ref(db, `${ORDERS_PATH}/${id}`);
  await remove(orderRef);
}

/** Subscribe to real-time orders updates */
export function subscribeToOrders(callback: (orders: Order[]) => void, onError?: (error: Error & { code?: string }) => void): () => void {
  const ordersRef = ref(db, ORDERS_PATH);
  const handler = onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const orders = Object.values(data) as Order[];
    orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(orders);
  }, (error) => {
    const dbError = error as Error & { code?: string };
    console.warn('[orders-service] RTDB subscription error:', dbError.code, dbError.message);
    if (onError) onError(dbError);
  });
  return () => off(ordersRef, 'value', handler);
}
