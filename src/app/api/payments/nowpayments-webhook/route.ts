import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

    if (!ipnSecret) {
      console.error('IPN_SECRET not configured');
      return NextResponse.json({ success: false, message: 'Server not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const signature = request.headers.get('x-nowpayments-sig');
    if (!signature) {
      console.warn('Missing signature header');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Reconstruct the body string for signature verification
    const bodyString = JSON.stringify(body, Object.keys(body).sort());
    const hash = crypto.createHmac('sha512', ipnSecret).update(bodyString).digest('hex');

    if (hash !== signature) {
      console.warn('Invalid signature');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Payment status mapping
    const { payment_id, payment_status, order_id, pay_amount, pay_currency } = body;
    const normalizedStatus = normalizePaymentStatus(payment_status || '');

    console.log(`[Webhook] Payment ID: ${payment_id}, Status: ${payment_status}, Order: ${order_id}`);

    // Use Firebase REST API for server-side database access (authenticated with API key)
    try {
      // Get all transactions to find matching payment_id
      const transactionsUrl = `${dbUrl}/transactions.json?auth=${apiKey}`;
      const transactionsResponse = await fetch(transactionsUrl);
      const transactionsData = await transactionsResponse.json();

      let foundTransaction: WebhookTransaction | null = null;
      let foundTransactionId: string | null = null;

      if (transactionsData && typeof transactionsData === 'object') {
        for (const key in transactionsData) {
          const t = transactionsData[key] as WebhookTransaction;
          if (t.paymentId === payment_id || (t.metadata && t.metadata.orderId === order_id)) {
            foundTransaction = t;
            foundTransactionId = key;
            break;
          }
        }
      }

      // Update transaction status via REST API
      if (foundTransaction && foundTransactionId) {
        const transactionUpdateUrl = `${dbUrl}/transactions/${foundTransactionId}.json?auth=${apiKey}`;
        // Only overwrite fields the webhook actually carries, so a missing
        // pay_amount/pay_currency can't clobber values from a previous update.
        const txPatch: Record<string, unknown> = {
          paymentStatus: normalizedStatus,
          updatedAt: new Date().toISOString(),
          paymentId: payment_id,
        };
        if (typeof pay_amount === 'number') txPatch.cryptoAmount = pay_amount;
        if (pay_currency) txPatch.cryptoCurrency = pay_currency.toUpperCase();
        await fetch(transactionUpdateUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txPatch),
        });

        console.log(`[Webhook] Updated transaction ${foundTransactionId} with status: ${payment_status}`);
      } else {
        console.warn(`[Webhook] Transaction not found for payment ID: ${payment_id}`);
      }

      // Handle different payment statuses
      if (normalizedStatus === 'confirmed') {
        console.log(`[Webhook] Payment confirmed for order: ${order_id}`);

        // Update associated order or shipment if exists
        if (foundTransaction?.type === 'gold_purchase' && foundTransaction?.orderId) {
          const orderUrl = `${dbUrl}/orders/${foundTransaction.orderId}.json?auth=${apiKey}`;
          await fetch(orderUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus: 'paid',
              paidAt: new Date().toISOString(),
            }),
          });
        } else if (foundTransaction?.type === 'shipment' && foundTransaction?.shipmentId) {
          const shipmentUrl = `${dbUrl}/shipments/${foundTransaction.shipmentId}.json?auth=${apiKey}`;
          await fetch(shipmentUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus: 'paid',
              paidAt: new Date().toISOString(),
            }),
          });
        }
      } else if (normalizedStatus === 'failed' || normalizedStatus === 'expired') {
        console.log(`[Webhook] Payment failed/expired for order: ${order_id}`);

        // Mark order/shipment as failed if needed
        if (foundTransaction?.orderId) {
          const orderUrl = `${dbUrl}/orders/${foundTransaction.orderId}.json?auth=${apiKey}`;
          await fetch(orderUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus: 'failed',
            }),
          });
        } else if (foundTransaction?.shipmentId) {
          const shipmentUrl = `${dbUrl}/shipments/${foundTransaction.shipmentId}.json?auth=${apiKey}`;
          await fetch(shipmentUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus: 'failed',
            }),
          });
        }
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the webhook - acknowledge receipt to NOWPayments
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
