import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * NOWPayments IPN (Instant Payment Notification) verification — pure and
 * server-safe. NOWPayments signs each webhook body with an HMAC-SHA512 of the
 * JSON body re-serialized with its keys sorted, delivered in the
 * `x-nowpayments-sig` header. This module is shared by the webhook route and
 * its unit tests so the verification path is exactly what ships.
 */

/**
 * Accepts any JSON-serializable object (including typed interfaces without
 * index signatures, like the webhook route's parsed body).
 */
type WebhookBody = object;

/**
 * Rebuild a value with all object keys sorted recursively (arrays keep their
 * element order). Matches the canonical form NOWPayments signs — their docs'
 * Node.js `sortObject`, PHP `tksort`, and Python `json.dumps(sort_keys=True)`
 * examples all sort nested objects, not just the top level.
 */
function sortKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysRecursively((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Reconstruct the canonical body string NOWPayments signs (recursively sorted keys). */
export function buildWebhookSignatureBody(body: WebhookBody): string {
  return JSON.stringify(sortKeysRecursively(body));
}

/** Compute the expected HMAC-SHA512 hex signature for a webhook body. */
export function computeWebhookSignature(secret: string, body: WebhookBody): string {
  return createHmac('sha512', secret).update(buildWebhookSignatureBody(body)).digest('hex');
}

/**
 * True when `received` is a valid signature for `body` under `secret`.
 * Rejects empty/malformed signatures and compares with a constant-time
 * equality so a timing side-channel can't leak the signature.
 */
export function verifyWebhookSignature(
  secret: string,
  body: WebhookBody,
  received: string
): boolean {
  if (!secret || typeof received !== 'string' || !received) return false;
  const expected = computeWebhookSignature(secret, body);
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
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
export function normalizePaymentStatus(status: string): string {
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
