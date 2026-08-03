// NOWPayments API integration

const API_BASE = 'https://api.nowpayments.io/v1';
const API_KEY = process.env.NEXT_PUBLIC_NOWPAYMENTS_API_KEY;

export interface PaymentData {
  orderId: string; // Unique order/shipment ID
  amount: number; // USD amount
  description: string;
  userEmail: string;
}

export interface NOWInvoiceResponse {
  id: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  pay_currency: string;
  ipn_callback_url: string;
  invoice_url: string;
  success_url: string;
  cancel_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a hosted invoice via NOWPayments
 */
export async function createInvoice(data: PaymentData): Promise<NOWInvoiceResponse> {
  if (!API_KEY) {
    throw new Error('NOWPayments API key not configured');
  }

  const response = await fetch(`${API_BASE}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: data.amount,
      price_currency: 'usd',
      order_id: data.orderId,
      order_description: data.description,
      ipn_callback_url: `${typeof window === 'undefined' ? '' : window.location.origin}/api/payments/nowpayments-webhook`,
      success_url: `${typeof window === 'undefined' ? '' : window.location.origin}/dashboard/client?payment=success`,
      cancel_url: `${typeof window === 'undefined' ? '' : window.location.origin}/dashboard/client?payment=cancelled`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create invoice');
  }

  return response.json();
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
  order_description: string;
  ipn_callback_url: string;
  created_at: string;
  updated_at: string;
  purchase_id: string;
  amount_received: number;
  payin_extra_id: string | null;
  smart_contract: string | null;
  network: string;
  network_precision: number;
  time_limit: string | null;
  burning_percent: number | null;
  expiration_estimate_date: string;
  is_fixed_rate: boolean;
  is_fee_paid_by_user: boolean;
  valid_until: string;
  type: string;
}

export interface PaymentRequest extends PaymentData {
  payCurrency: string; // e.g., 'btc', 'eth'
}

export async function createPayment(data: PaymentRequest): Promise<NOWPaymentResponse> {
  if (!API_KEY) throw new Error('NOWPayments API key not configured');

  const response = await fetch(`${API_BASE}/payment`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: data.amount,
      price_currency: 'usd',
      pay_currency: data.payCurrency,
      order_id: data.orderId,
      order_description: data.description,
      ipn_callback_url: `${typeof window === 'undefined' ? '' : window.location.origin}/api/payments/nowpayments-webhook`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment');
  }
  return response.json();
}

export async function getPaymentStatus(paymentId: string): Promise<{ payment_status: string }> {
  if (!API_KEY) throw new Error('NOWPayments API key not configured');

  const response = await fetch(`${API_BASE}/payment/${paymentId}`, {
    method: 'GET',
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get payment status');
  }

  return response.json();
}
