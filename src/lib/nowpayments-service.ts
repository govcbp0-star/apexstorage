import { auth } from '@/lib/firebase';

export interface CreatePaymentRequest {
  orderId: string;
  transactionId: string;
  payCurrency: string;
}

export interface NOWPaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  created_at: string;
}

async function postAuthenticated<T>(path: string, data: object): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in again before continuing with payment.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({})) as { message?: string } & T;

  if (!response.ok) {
    throw new Error(result.message || 'The payment request could not be completed.');
  }

  return result;
}

/** Create a payment through our authenticated server route. */
export function createPayment(data: CreatePaymentRequest): Promise<NOWPaymentResponse> {
  return postAuthenticated<NOWPaymentResponse>('/api/payments/create', data);
}

/** Read payment status through our authenticated server route. */
export function getPaymentStatus(
  paymentId: string,
  transactionId: string
): Promise<{ payment_status: string }> {
  return postAuthenticated<{ payment_status: string }>('/api/payments/status', {
    paymentId,
    transactionId,
  });
}
