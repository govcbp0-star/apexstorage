import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { verifyWebhookSignature, normalizePaymentStatus } from '@/lib/nowpayments-signature';
import {
  goldOrderIntegrityFields,
  shipmentIntegrityFields,
  verifyRecordIntegrity,
} from '@/lib/record-integrity';

interface NOWPaymentsWebhookBody {
  payment_id?: string;
  payment_status?: string;
  order_id?: string;
  pay_amount?: number;
  pay_currency?: string;
  price_amount?: number;
  price_currency?: string;
}

interface WebhookTransaction {
  userId?: string;
  paymentId?: string;
  type?: 'gold_purchase' | 'shipment';
  orderId?: string;
  shipmentId?: string;
  amount?: number;
  metadata?: {
    orderId?: string;
    [key: string]: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NOWPaymentsWebhookBody;
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (!ipnSecret) {
      console.error('[Webhook] IPN_SECRET not configured');
      return NextResponse.json({ success: false, message: 'Server not configured' }, { status: 500 });
    }

    // Verify webhook signature (HMAC-SHA512 over the sorted-key body JSON)
    const signature = request.headers.get('x-nowpayments-sig') || '';
    if (!verifyWebhookSignature(ipnSecret, body, signature)) {
      console.warn('[Webhook] Missing or invalid signature');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Payment status mapping
    const { payment_id, payment_status, order_id, pay_amount, pay_currency, price_amount, price_currency } = body;
    const normalizedStatus = normalizePaymentStatus(payment_status || '');

    console.log(`[Webhook] Payment ID: ${payment_id}, Status: ${payment_status}, Order: ${order_id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Server-side RTDB access via the Firebase Admin SDK.
    //
    // Historical note: this used to call the RTDB REST API with the web API key
    // (`?auth=<NEXT_PUBLIC_FIREBASE_API_KEY>`), which Firebase rejects with 401
    // Permission denied — so every webhook-driven update silently no-opped in
    // production. The Admin SDK authenticates as the project's service account
    // (bypassing database rules), the same proven path the auth routes and the
    // seed script use, so webhook updates actually land.
    // ─────────────────────────────────────────────────────────────────────────
    if (!isAdminConfigured()) {
      console.warn('[Webhook] Firebase Admin SDK not configured — skipping RTDB updates');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    try {
      const db = getAdminDb();

      // Find the transaction matching this payment.
      let foundTransaction: WebhookTransaction | null = null;
      let foundTransactionId: string | null = null;

      if (payment_id || order_id) {
        const snap = await db.ref('transactions').once('value');
        const transactionsData = snap.val();
        if (transactionsData && typeof transactionsData === 'object') {
          for (const key in transactionsData) {
            const t = transactionsData[key] as WebhookTransaction;
            const matchesPayment = Boolean(payment_id && t.paymentId === payment_id);
            const matchesOrder = Boolean(
              order_id &&
              (t.metadata?.orderId === order_id || t.orderId === order_id || t.shipmentId === order_id)
            );
            const isCurrentPayment = !payment_id || !t.paymentId || t.paymentId === payment_id;

            if (matchesPayment || (matchesOrder && isCurrentPayment)) {
              foundTransaction = t;
              foundTransactionId = key;
              break;
            }
          }
        }
      }

      // Update transaction status (PATCH semantics — only touch fields the
      // webhook actually carries, so a missing pay_amount/pay_currency can't
      // clobber values from a previous update).
      if (foundTransaction && foundTransactionId) {
        const signedLink = await verifyLinkedPaymentRecord(db, foundTransactionId, foundTransaction);
        const amountMatches = signedLink && Number.isFinite(foundTransaction.amount) &&
          Math.round(Number(foundTransaction.amount) * 100) === Math.round(signedLink.amount * 100);
        const callbackMatchesOrder = Boolean(order_id && signedLink?.orderId === order_id);
        const callbackMatchesAmount = normalizedStatus !== 'confirmed' || (
          typeof price_amount === 'number' &&
          Math.round(price_amount * 100) === Math.round((signedLink?.amount || 0) * 100) &&
          String(price_currency || '').toLowerCase() === 'usd'
        );
        if (!signedLink || !amountMatches || !callbackMatchesOrder || !callbackMatchesAmount) {
          console.warn('[Webhook] Ignoring a payment update that does not match its signed order amount and ID.');
          return NextResponse.json({ success: true }, { status: 200 });
        }

        const txPatch: Record<string, unknown> = {
          paymentStatus: normalizedStatus,
          updatedAt: new Date().toISOString(),
        };
        if (payment_id) txPatch.paymentId = payment_id;
        if (typeof pay_amount === 'number') txPatch.cryptoAmount = pay_amount;
        if (pay_currency) txPatch.cryptoCurrency = pay_currency.toUpperCase();

        await db.ref(`transactions/${foundTransactionId}`).update(txPatch);
        console.log(`[Webhook] Updated transaction ${foundTransactionId} with status: ${payment_status}`);
      } else {
        console.warn(`[Webhook] Transaction not found for payment ID: ${payment_id}`);
      }

      // Handle different payment statuses
      if (normalizedStatus === 'confirmed') {
        console.log(`[Webhook] Payment confirmed for order: ${order_id}`);

        // Update associated order or shipment if exists
        if (foundTransaction?.type === 'gold_purchase' && foundTransaction?.orderId) {
          await db.ref(`orders/${foundTransaction.orderId}`).update({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString(),
          });
          console.log(`[Webhook] Marked order ${foundTransaction.orderId} as paid`);
        } else if (foundTransaction?.type === 'shipment' && foundTransaction?.shipmentId) {
          await db.ref(`shipments/${foundTransaction.shipmentId}`).update({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString(),
          });
          console.log(`[Webhook] Marked shipment ${foundTransaction.shipmentId} as paid`);
        }
      } else if (normalizedStatus === 'failed' || normalizedStatus === 'expired') {
        console.log(`[Webhook] Payment failed/expired for order: ${order_id}`);

        // Mark order/shipment as failed if needed
        if (foundTransaction?.type === 'gold_purchase' && foundTransaction?.orderId) {
          await db.ref(`orders/${foundTransaction.orderId}`).update({
            paymentStatus: 'failed',
          });
          console.log(`[Webhook] Marked order ${foundTransaction.orderId} as failed`);
        } else if (foundTransaction?.type === 'shipment' && foundTransaction?.shipmentId) {
          await db.ref(`shipments/${foundTransaction.shipmentId}`).update({
            paymentStatus: 'failed',
          });
          console.log(`[Webhook] Marked shipment ${foundTransaction.shipmentId} as failed`);
        }
      }
    } catch (dbError) {
      console.error('[Webhook] Database error:', dbError);
      // Don't fail the webhook - acknowledge receipt to NOWPayments
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook] Webhook error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}

async function verifyLinkedPaymentRecord(
  database: ReturnType<typeof getAdminDb>,
  transactionId: string,
  transaction: WebhookTransaction
): Promise<{ orderId: string; amount: number } | null> {
  if (transaction.type === 'gold_purchase' && transaction.orderId) {
    const snapshot = await database.ref(`orders/${transaction.orderId}`).once('value');
    const order = snapshot.val() as Record<string, unknown> | null;
    if (
      order &&
      order.userId === transaction.userId &&
      order.id === transaction.orderId &&
      order.transactionId === transactionId &&
      order.recordVersion === 1 &&
      verifyRecordIntegrity('gold-order', goldOrderIntegrityFields(order), order.recordIntegrity)
    ) {
      const amount = Number(order.estimatedTotal);
      return Number.isFinite(amount) && amount > 0 ? { orderId: transaction.orderId, amount } : null;
    }
  }

  if (transaction.type === 'shipment' && transaction.shipmentId) {
    const snapshot = await database.ref(`shipments/${transaction.shipmentId}`).once('value');
    const shipment = snapshot.val() as Record<string, unknown> | null;
    if (
      shipment &&
      shipment.userId === transaction.userId &&
      shipment.id === transaction.shipmentId &&
      shipment.transactionId === transactionId &&
      shipment.recordVersion === 1 &&
      verifyRecordIntegrity('shipment', shipmentIntegrityFields(shipment), shipment.recordIntegrity)
    ) {
      const amount = Number(shipment.shipmentFee);
      return Number.isFinite(amount) && amount > 0 ? { orderId: transaction.shipmentId, amount } : null;
    }
  }

  return null;
}
