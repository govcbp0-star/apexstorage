/** Transaction records are created and updated by authenticated server routes. */
export interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: 'gold_purchase' | 'shipment';
  description: string;
  amount: number;
  currency: string;
  cryptoCurrency: string;
  cryptoAmount: number;
  paymentId: string;
  paymentStatus: 'pending' | 'confirmed' | 'failed' | 'expired';
  secondaryEmail?: string;
  orderId?: string;
  shipmentId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
