import { ref, push, set, get, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db } from './firebase';

export interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: 'gold_purchase' | 'shipment'; // Transaction type
  description: string;
  amount: number; // USD amount
  currency: string; // fiat currency
  cryptoCurrency: string; // Crypto used (BTC, ETH, etc.)
  cryptoAmount: number; // Amount in crypto
  paymentId: string; // NOWPayments payment ID
  paymentStatus: 'pending' | 'confirmed' | 'failed' | 'expired';
  orderId?: string; // Link to order if gold purchase
  shipmentId?: string; // Link to shipment if shipment
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  metadata?: Record<string, any>; // Additional data
}

/**
 * Submit a transaction to RTDB
 */
export async function submitTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const transactionsRef = ref(db, 'transactions');
  const newTransactionRef = push(transactionsRef);

  const transactionData: Transaction = {
    ...data,
    id: newTransactionRef.key || '',
    createdAt: now,
    updatedAt: now,
  };

  await set(newTransactionRef, transactionData);
  return newTransactionRef.key || '';
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  transactionId: string,
  status: 'pending' | 'confirmed' | 'failed' | 'expired'
): Promise<void> {
  const transactionRef = ref(db, `transactions/${transactionId}`);
  await set(transactionRef, { paymentStatus: status, updatedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Get transaction by payment ID
 */
export async function getTransactionByPaymentId(paymentId: string): Promise<Transaction | null> {
  const transactionsRef = ref(db, 'transactions');
  const snapshot = await get(transactionsRef);

  if (snapshot.exists()) {
    const data = snapshot.val();
    for (const key in data) {
      if (data[key].paymentId === paymentId) {
        return { ...data[key], id: key } as Transaction;
      }
    }
  }

  return null;
}

/**
 * Subscribe to user transactions (real-time updates)
 */
export function subscribeToTransactions(
  userId: string,
  onData: (transactions: Transaction[]) => void,
  onError: (error: any) => void
): () => void {
  try {
    const transactionsRef = ref(db, 'transactions');
    
    const unsubscribe = onValue(
      transactionsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const transactions = Object.keys(data)
            .filter(key => data[key].userId === userId)
            .map((key) => ({ ...data[key], id: key } as Transaction))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          onData(transactions);
        } else {
          onData([]);
        }
      },
      (error) => {
        onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    onError(error);
    return () => {};
  }
}

/**
 * Get all transactions (admin only)
 */
export async function getAllTransactions(): Promise<Transaction[]> {
  const transactionsRef = ref(db, 'transactions');
  const snapshot = await get(transactionsRef);

  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data)
      .map((key) => ({ ...data[key], id: key } as Transaction))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return [];
}
