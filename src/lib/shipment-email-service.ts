import { render } from '@react-email/render';
import * as React from 'react';
import { readRTDB, writeRTDB, getAdminAuth } from '@/lib/firebase-admin';
import { assertEmailConfig, getResend, EMAIL_FROM, REPLY_TO, SUPPORT_EMAIL } from '@/lib/resend';
import ShipmentEmail from '@/lib/email/shipment';

/**
 * Server-only shipment notification email service.
 *
 * Delivers the branded shipment email after a shipment has been created and
 * paid for. The client calls POST /api/shipments/notify with the signed-in
 * user's Firebase ID token once payment is confirmed; this service:
 *
 *   1. Loads the persisted shipment record (the source of truth — nothing
 *      is recalculated) using the caller's ID token.
 *   2. Rejects if the shipment does not exist, was already notified
 *      (idempotency marker), or the caller is not the shipment owner.
 *   3. Resolves the secondary notification email from the linked
 *      transaction record, falling back to the value passed by the client.
 *   4. Renders the branded template and delivers it to the primary email
 *      plus the secondary email (when present and valid).
 *   5. Marks the shipment `notificationEmailSent` ONLY after Resend accepts
 *      the email, so a transient failure is retried instead of lost — while
 *      a successful send can never be duplicated.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export type ShipmentEmailErrorCode =
  | 'invalid-request'
  | 'not-found'
  | 'not-authorized'
  | 'already-sent'
  | 'no-recipients'
  | 'not-configured'
  | 'send-failed'
  | 'server-error';

export interface ShipmentEmailResult {
  success: boolean;
  code?: ShipmentEmailErrorCode;
  message: string;
  /** Present when the notification was skipped because it already went out. */
  skipped?: 'already-sent';
  /** Number of recipients the email was accepted for. */
  recipients?: number;
}

interface ShipmentRecord {
  id?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  assetRef?: string;
  shippingAmount?: string;
  partialGrams?: number;
  weight?: number;
  shipmentFee?: number;
  vaultLocation?: string;
  goldPrice?: number;
  goldValue?: number;
  deliveryName?: string;
  deliveryPhone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPostcode?: string;
  deliveryCountry?: string;
  status?: string;
  date?: string;
  paymentStatus?: string;
  notificationEmailSent?: boolean;
  emailSentAt?: string;
  [key: string]: unknown;
}

interface TransactionRecord {
  secondaryEmail?: string;
  shipmentId?: string;
  orderId?: string;
  metadata?: { orderId?: string; secondaryEmail?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Find the secondary notification email on the transaction linked to the shipment. */
function findSecondaryEmail(transactions: Record<string, TransactionRecord> | null, shipmentId: string): string {
  if (!transactions || typeof transactions !== 'object') return '';
  for (const key of Object.keys(transactions)) {
    const t = transactions[key];
    if (!t || typeof t !== 'object') continue;
    const linksToShipment =
      t.shipmentId === shipmentId ||
      t.orderId === shipmentId ||
      t.metadata?.orderId === shipmentId;
    if (!linksToShipment) continue;
    const secondary = t.secondaryEmail || t.metadata?.secondaryEmail || '';
    if (secondary) return String(secondary).trim();
  }
  return '';
}

/**
 * Deliver the branded shipment notification email for a persisted shipment.
 *
 * @param shipmentId - id of the shipment record in RTDB
 * @param opts.idToken - Firebase ID token of the signed-in caller (used to
 *   read/write RTDB and to verify the caller owns the shipment)
 * @param opts.secondaryEmail - optional secondary email captured client-side;
 *   the transaction record is consulted first as the persisted source of truth
 */
export async function sendShipmentNotification(
  shipmentId: string,
  opts: { idToken: string; secondaryEmail?: string }
): Promise<ShipmentEmailResult> {
  if (!shipmentId || !opts.idToken) {
    return { success: false, code: 'invalid-request', message: 'Shipment ID and authorization are required.' };
  }

  try {
    assertEmailConfig();
  } catch (err) {
    console.error('[ShipmentEmail] Email configuration validation failed:', err);
    return { success: false, code: 'not-configured', message: 'Email service is not configured.' };
  }

  // 1. Load the persisted shipment record — source of truth for the email.
  const shipment = (await readRTDB(`shipments/${shipmentId}`, opts.idToken)) as ShipmentRecord | null;
  if (!shipment || !shipment.id) {
    return { success: false, code: 'not-found', message: 'Shipment not found.' };
  }

  // 2. Idempotency — a delivered notification is never sent again.
  if (shipment.notificationEmailSent === true || shipment.emailSentAt) {
    return { success: true, code: 'already-sent', skipped: 'already-sent', message: 'Shipment notification already sent.' };
  }

  // 3. Ownership gate — only the shipment's owner may trigger its email.
  try {
    const decoded = await getAdminAuth().verifyIdToken(opts.idToken);
    if (decoded.uid !== shipment.userId) {
      return { success: false, code: 'not-authorized', message: 'You are not authorized to access this shipment.' };
    }
  } catch (err) {
    console.error('[ShipmentEmail] ID token verification failed:', err);
    return { success: false, code: 'not-authorized', message: 'Invalid authorization token.' };
  }

  // 4. Resolve the secondary recipient — persisted transaction value first,
  //    then the value passed by the client (the same one the checkout modal
  //    saved to the transaction).
  let secondaryEmail = (opts.secondaryEmail || '').trim();
  try {
    const transactions = (await readRTDB('transactions', opts.idToken)) as Record<string, TransactionRecord> | null;
    const persistedSecondary = findSecondaryEmail(transactions, shipmentId);
    if (persistedSecondary) secondaryEmail = persistedSecondary;
  } catch (err) {
    console.warn('[ShipmentEmail] Could not read transactions for secondary email:', err);
  }

  const primary = String(shipment.userEmail || '').trim();
  const recipients = Array.from(
    new Set(
      [primary, secondaryEmail]
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email && EMAIL_RE.test(email))
    )
  );

  if (recipients.length === 0) {
    return { success: false, code: 'no-recipients', message: 'No valid recipient email on the shipment record.' };
  }

  // 5. Render the branded template from the persisted record.
  let html: string;
  try {
    html = await render(
      React.createElement(ShipmentEmail, {
        shipment: {
          id: shipment.id,
          userName: shipment.userName,
          userEmail: shipment.userEmail,
          weight: shipment.weight,
          shippingAmount: shipment.shippingAmount,
          partialGrams: shipment.partialGrams,
          vaultLocation: shipment.vaultLocation,
          goldPrice: shipment.goldPrice,
          goldValue: shipment.goldValue,
          shipmentFee: shipment.shipmentFee,
          deliveryName: shipment.deliveryName,
          deliveryPhone: shipment.deliveryPhone,
          deliveryAddress: shipment.deliveryAddress,
          deliveryCity: shipment.deliveryCity,
          deliveryPostcode: shipment.deliveryPostcode,
          deliveryCountry: shipment.deliveryCountry,
          date: shipment.date,
          status: shipment.status,
          assetRef: shipment.assetRef,
        },
        supportEmail: SUPPORT_EMAIL,
      })
    );
  } catch (err) {
    console.error('[ShipmentEmail] Template render failed:', err);
    return { success: false, code: 'server-error', message: 'Failed to render shipment email.' };
  }

  // 6. Deliver via Resend.
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: REPLY_TO,
      to: recipients,
      subject: 'Your APEXSTORAGE Shipment Has Been Received',
      html,
    });
    if (error) {
      console.error('[ShipmentEmail] Resend delivery failed:', { to: recipients, subject: 'Shipment', error });
      return { success: false, code: 'send-failed', message: 'Failed to send shipment email.' };
    }
    if (!data?.id) {
      console.error('[ShipmentEmail] Resend returned no message id:', { to: recipients, data });
      return { success: false, code: 'send-failed', message: 'Failed to send shipment email.' };
    }
    console.info('[ShipmentEmail] Resend accepted shipment email:', { to: recipients, id: data.id });
  } catch (err) {
    console.error('[ShipmentEmail] Resend delivery threw:', err);
    return { success: false, code: 'send-failed', message: 'Failed to send shipment email.' };
  }

  // 7. Mark delivered only after acceptance — a failed send must be retried.
  try {
    await writeRTDB(
      `shipments/${shipmentId}`,
      { notificationEmailSent: true, emailSentAt: new Date().toISOString() },
      opts.idToken
    );
  } catch (err) {
    console.error('[ShipmentEmail] Failed to record delivery marker:', err);
  }

  return { success: true, recipients: recipients.length, message: 'Shipment notification sent successfully.' };
}
