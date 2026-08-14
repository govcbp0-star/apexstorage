import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb, isAdminConfigured } from '@/lib/firebase-admin';

interface NOWPaymentsWebhookBody {
  payment_id?: string;
  payment_status?: string;
  order_id?: string;
  pay_amount?: number;
  pay_currency?: string;
}

interface WebhookTransaction {
  paymentId?: string;
  type?: 'gold_purchase' | 'shipment';
  orderId?: string;
  shipmentId?: string;
  metadata?: {
    orderId?: string;
    [key: string]: unknown;
  };
}

/**
 * Map a NOWPayments webhook status to the app's transaction paymentStatus.
 *
 * Only FINAL success states ('finished'/'confirmed') count as confirmed.
 * 'confirming' and 'sending' are intermediate — the payment can still fail,
 * so they must not mark the order as paid (that would let fulfilment happen
 * before the funds actually arrive). A later 'failed' webhook would flip the
 * order back, but 'paidAt' would already be stamped and gold may have shipped.
 * 'refunded' is treated as failed so a chargeback flips the order back too.
 */
function normalizePaymentStatus(status: string): string {
  if (status === 'finished' || status === 'confirmed') {
    return 'confirmed';
  }
  if (status === 'failed' || status === 'refunded') {
    return 'failed';
  }
  if (status === 'expired') {
    return 'expired';
  }
  return 'pending';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NOWPaymentsWebhookBody;
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (!ipnSecret) {
      console.error('[Webhook] IPN_SECRET not configured');
      return NextResponse.json({ success: false, message: 'Server not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const signature = request.headers.get('x-nowpayments-sig');
    if (!signature) {
      console.warn('[Webhook] Missing signature header');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Reconstruct the body string for signature verification
    const bodyString = JSON.stringify(body, Object.keys(body).sort());
    const hash = crypto.createHmac('sha512', ipnSecret).update(bodyString).digest('hex');

    if (hash !== signature) {
      console.warn('[Webhook] Invalid signature');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Payment status mapping
    const { payment_id, payment_status, order_id, pay_amount, pay_currency } = body;
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
            if (
              (payment_id && t.paymentId === payment_id) ||
              (order_id &&
                (t.metadata?.orderId === order_id ||
                  t.orderId === order_id ||
                  t.shipmentId === order_id))
            ) {
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
