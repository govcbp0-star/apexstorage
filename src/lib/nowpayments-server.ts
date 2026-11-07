import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  goldOrderIntegrityFields,
  shipmentIntegrityFields,
  verifyRecordIntegrity,
} from '@/lib/record-integrity';
import { normalizePaymentStatus } from '@/lib/nowpayments-signature';

const API_BASE = 'https://api.nowpayments.io/v1';
const SUPPORTED_CURRENCIES = new Set(['usdterc20', 'btc', 'eth', 'usdc']);

export class PaymentRouteError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PaymentRouteError';
  }
}

interface PaymentTransaction {
  userId?: string;
  userEmail?: string;
  type?: string;
  paymentId?: string;
  cryptoCurrency?: string;
  paymentStatus?: string;
  amount?: number;
  orderId?: string;
  shipmentId?: string;
  metadata?: Record<string, unknown>;
}

interface SignedPaymentLink {
  orderId: string;
  amount: number;
}

interface SignedPaymentRecord extends Record<string, unknown> {
  id?: string;
  userId?: string;
  transactionId?: string;
  recordVersion?: number;
  recordIntegrity?: string;
}

interface ProviderPayment {
  payment_id?: string | number;
  payment_status?: string;
  pay_address?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  pay_currency?: string;
  order_id?: string;
  created_at?: string;
}

export interface PublicPayment {
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

export async function verifyPaymentUser(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new PaymentRouteError('Please sign in before starting or checking a payment.', 401);
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifyIdToken(match[1].trim());
  } catch {
    throw new PaymentRouteError('Your session has expired. Please sign in again.', 401);
  }

  if (decoded.email_verified !== true) {
    throw new PaymentRouteError('Verify your email before making a payment.', 403);
  }

  return decoded;
}

function getApiKey(): string {
  const apiKey = process.env.NOWPAYMENTS_API_KEY?.trim();
  if (!apiKey) {
    throw new PaymentRouteError('NOWPayments is not configured on the server.', 503);
  }
  return apiKey;
}

function getAppOrigin(): string {
  const previewUrl = process.env.VERCEL_ENV === 'preview' ? process.env.VERCEL_URL : undefined;
  const rawUrl = previewUrl
    ? `https://${previewUrl}`
    : process.env.APP_URL?.trim() || 'http://localhost:3000';

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new Error('Production payment URL must use HTTPS.');
    }
    return url.origin;
  } catch {
    throw new PaymentRouteError('APP_URL is not configured as a valid application URL.', 503);
  }
}

async function callProvider<T>(path: string, init: { method?: 'GET' | 'POST'; body?: string } = {}): Promise<T> {
  const apiKey = getApiKey();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'x-api-key': apiKey,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new PaymentRouteError('NOWPayments could not be reached. Please try again.', 502);
  }

  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error('[NOWPayments] Provider request failed:', response.status);
    throw new PaymentRouteError('NOWPayments could not process the request. Please try again.', 502);
  }

  return data as T;
}

function safeDescription(value: string): string {
  return value.replace(/[\r\n\t]/g, ' ').slice(0, 200);
}

function toPublicPayment(payment: ProviderPayment, orderId: string, fallbackAmount: number, fallbackId = ''): PublicPayment {
  const paymentId = payment.payment_id ? String(payment.payment_id) : fallbackId;
  if (!paymentId || !payment.pay_address || !payment.pay_currency || typeof payment.pay_amount !== 'number') {
    throw new PaymentRouteError('NOWPayments returned incomplete payment details.', 502);
  }

  return {
    payment_id: paymentId,
    payment_status: payment.payment_status || 'waiting',
    pay_address: payment.pay_address,
    price_amount: Number(payment.price_amount) || fallbackAmount,
    price_currency: payment.price_currency || 'usd',
    pay_amount: payment.pay_amount,
    pay_currency: payment.pay_currency,
    order_id: payment.order_id || orderId,
    created_at: payment.created_at || new Date().toISOString(),
  };
}

export async function createPaymentForTransaction(input: {
  uid: string;
  orderId: string;
  transactionId: string;
  payCurrency: string;
}): Promise<PublicPayment> {
  const { uid, orderId, transactionId, payCurrency } = input;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId) || !/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) {
    throw new PaymentRouteError('The order or transaction reference is invalid.', 400);
  }
  if (!SUPPORTED_CURRENCIES.has(payCurrency)) {
    throw new PaymentRouteError('Choose a supported payment currency.', 400);
  }

  const database = getAdminDb();
  const transactionRef = database.ref(`transactions/${transactionId}`);
  const transactionSnapshot = await transactionRef.once('value');
  const transaction = transactionSnapshot.val() as PaymentTransaction | null;
  if (!transaction) {
    throw new PaymentRouteError('The payment transaction could not be found.', 404);
  }
  if (transaction.userId !== uid) {
    throw new PaymentRouteError('You cannot pay for this transaction.', 403);
  }
  const linkedOrderId = transaction.orderId || transaction.shipmentId || transaction.metadata?.orderId;
  if (
    linkedOrderId !== orderId ||
    !['pending', 'failed', 'expired'].includes(String(transaction.paymentStatus || '').toLowerCase())
  ) {
    throw new PaymentRouteError('This transaction is not available for payment.', 409);
  }

  let amount: number;
  let description: string;
  if (transaction.type === 'gold_purchase' && orderId.startsWith(`${uid}_order_`)) {
    const orderSnapshot = await database.ref(`orders/${orderId}`).once('value');
    const order = orderSnapshot.val() as SignedPaymentRecord | null;
    if (!order || order.userId !== uid || order.paymentMethod !== 'crypto' ||
        !['pending', 'failed', 'expired'].includes(String(order.paymentStatus || '').toLowerCase())) {
      throw new PaymentRouteError('This gold order is not available for payment.', 409);
    }
    if (
      order.recordVersion !== 1 ||
      order.transactionId !== transactionId ||
      !verifyRecordIntegrity('gold-order', goldOrderIntegrityFields(order), order.recordIntegrity)
    ) {
      throw new PaymentRouteError(
        'This order was created before secure checkout was enabled. Please create a new order.',
        409
      );
    }
    amount = Number(order.estimatedTotal);
    description = `Buy ${String(order.productType || 'gold')} - ${Number(order.quantityGrams) || 0}g`;
  } else if (transaction.type === 'shipment' && orderId.startsWith(`${uid}_shipment_`)) {
    const shipmentSnapshot = await database.ref(`shipments/${orderId}`).once('value');
    const shipment = shipmentSnapshot.val() as SignedPaymentRecord | null;
    if (!shipment || shipment.userId !== uid || shipment.paymentMethod !== 'crypto' ||
        !['pending', 'failed', 'expired'].includes(String(shipment.paymentStatus || '').toLowerCase())) {
      throw new PaymentRouteError('This shipment is not available for payment.', 409);
    }
    if (
      shipment.recordVersion !== 1 ||
      shipment.transactionId !== transactionId ||
      !verifyRecordIntegrity('shipment', shipmentIntegrityFields(shipment), shipment.recordIntegrity)
    ) {
      throw new PaymentRouteError(
        'This shipment was created before secure checkout was enabled. Please create a new shipment.',
        409
      );
    }
    amount = Number(shipment.shipmentFee) || 50;
    description = `Shipment: ${String(shipment.deliveryCity || '')}, ${String(shipment.deliveryCountry || '')}`;
  } else {
    throw new PaymentRouteError('The order does not match this transaction.', 400);
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PaymentRouteError('The saved order has an invalid payment amount.', 409);
  }
  if (!Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) !== amount) {
    throw new PaymentRouteError('The saved transaction does not match the signed order amount.', 409);
  }

  if (transaction.paymentId) {
    const existingPayment = await callProvider<ProviderPayment>(
      `/payment/${encodeURIComponent(transaction.paymentId)}`
    );
    const existingStatus = String(existingPayment.payment_status || '').toLowerCase();
    if (!['failed', 'expired', 'refunded'].includes(existingStatus)) {
      assertProviderPaymentMatchesOrder(existingPayment, orderId, amount);
      // Reuse the active payment after a retry/reopen; never create a second
      // payable address for the same transaction.
      return toPublicPayment(existingPayment, orderId, amount, transaction.paymentId);
    }
  }

  const appOrigin = getAppOrigin();
  const payment = await callProvider<ProviderPayment>('/payment', {
    method: 'POST',
    body: JSON.stringify({
      price_amount: Math.round(amount * 100) / 100,
      price_currency: 'usd',
      pay_currency: payCurrency,
      order_id: orderId,
      order_description: safeDescription(description),
      ipn_callback_url: `${appOrigin}/api/payments/nowpayments-webhook`,
    }),
  });

  assertProviderPaymentMatchesOrder(payment, orderId, amount);
  const publicPayment = toPublicPayment(payment, orderId, amount);

  await transactionRef.update({
    paymentId: publicPayment.payment_id,
    cryptoCurrency: publicPayment.pay_currency,
    cryptoAmount: publicPayment.pay_amount,
    paymentStatus: 'pending',
    updatedAt: new Date().toISOString(),
  });
  if (transaction.type === 'gold_purchase') {
    await database.ref(`orders/${orderId}`).update({ paymentStatus: 'pending' });
  } else {
    await database.ref(`shipments/${orderId}`).update({ paymentStatus: 'pending' });
  }

  return publicPayment;
}

export async function getPaymentStatusForTransaction(input: {
  uid: string;
  paymentId: string;
  transactionId: string;
}): Promise<{ payment_status: string }> {
  const { uid, paymentId, transactionId } = input;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId) || !paymentId || paymentId.length > 128) {
    throw new PaymentRouteError('The payment reference is invalid.', 400);
  }

  const transactionSnapshot = await getAdminDb().ref(`transactions/${transactionId}`).once('value');
  const transaction = transactionSnapshot.val() as PaymentTransaction | null;
  if (!transaction || transaction.userId !== uid || transaction.paymentId !== paymentId) {
    throw new PaymentRouteError('You cannot check this payment.', 404);
  }
  const signedLink = await assertSignedLinkedRecord(uid, transactionId, transaction);

  const payment = await callProvider<ProviderPayment>(`/payment/${encodeURIComponent(paymentId)}`);
  assertProviderPaymentMatchesOrder(payment, signedLink.orderId, signedLink.amount);
  if (typeof payment.payment_status !== 'string') throw new PaymentRouteError('NOWPayments returned an invalid payment status.', 502);

  const normalizedStatus = normalizePaymentStatus(payment.payment_status);
  if (normalizedStatus !== 'pending') {
    const database = getAdminDb();
    const now = new Date().toISOString();
    const transactionPatch: Record<string, unknown> = {
      paymentStatus: normalizedStatus,
      updatedAt: now,
    };
    const resourcePaymentStatus = normalizedStatus === 'confirmed' ? 'paid' : normalizedStatus;
    if (normalizedStatus === 'confirmed') transactionPatch.paidAt = now;
    await database.ref(`transactions/${transactionId}`).update(transactionPatch);
    const resourceId = transaction.type === 'gold_purchase' ? transaction.orderId : transaction.shipmentId;
    const resourcePath = transaction.type === 'gold_purchase' ? 'orders' : 'shipments';
    if (resourceId) {
      await database.ref(`${resourcePath}/${resourceId}`).update({
        paymentStatus: resourcePaymentStatus,
        ...(normalizedStatus === 'confirmed' ? { paidAt: now } : {}),
      });
    }
  }

  return { payment_status: payment.payment_status };
}

async function assertSignedLinkedRecord(
  uid: string,
  transactionId: string,
  transaction: PaymentTransaction
): Promise<SignedPaymentLink> {
  const database = getAdminDb();
  if (transaction.type === 'gold_purchase' && transaction.orderId?.startsWith(`${uid}_order_`)) {
    const snapshot = await database.ref(`orders/${transaction.orderId}`).once('value');
    const order = snapshot.val() as SignedPaymentRecord | null;
    if (
      order?.userId === uid &&
      order.id === transaction.orderId &&
      order.transactionId === transactionId &&
      order.recordVersion === 1 &&
      verifyRecordIntegrity('gold-order', goldOrderIntegrityFields(order), order.recordIntegrity)
    ) {
      const amount = Number(order.estimatedTotal);
      if (Number.isFinite(amount) && amount > 0 && amountsMatch(transaction.amount, amount)) {
        return { orderId: transaction.orderId, amount };
      }
    }
  }

  if (transaction.type === 'shipment' && transaction.shipmentId?.startsWith(`${uid}_shipment_`)) {
    const snapshot = await database.ref(`shipments/${transaction.shipmentId}`).once('value');
    const shipment = snapshot.val() as SignedPaymentRecord | null;
    if (
      shipment?.userId === uid &&
      shipment.id === transaction.shipmentId &&
      shipment.transactionId === transactionId &&
      shipment.recordVersion === 1 &&
      verifyRecordIntegrity('shipment', shipmentIntegrityFields(shipment), shipment.recordIntegrity)
    ) {
      const amount = Number(shipment.shipmentFee);
      if (Number.isFinite(amount) && amount > 0 && amountsMatch(transaction.amount, amount)) {
        return { orderId: transaction.shipmentId, amount };
      }
    }
  }

  throw new PaymentRouteError(
    'This payment record predates secure checkout or no longer matches its transaction.',
    409
  );
}

function amountsMatch(value: unknown, expected: number): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && Math.round(amount * 100) === Math.round(expected * 100);
}

function assertProviderPaymentMatchesOrder(payment: ProviderPayment, orderId: string, amount: number): void {
  if (
    typeof payment.price_amount !== 'number' ||
    Math.round(payment.price_amount * 100) !== Math.round(amount * 100) ||
    String(payment.price_currency || '').toLowerCase() !== 'usd' ||
    payment.order_id !== orderId
  ) {
    throw new PaymentRouteError('The NOWPayments invoice does not match this order amount.', 409);
  }
}
