import { NextRequest, NextResponse } from 'next/server';
import { sendShipmentNotification } from '@/lib/shipment-email-service';

/**
 * POST /api/shipments/notify
 * Body: { shipmentId: string, secondaryEmail?: string }
 * Headers: Authorization: Bearer <Firebase ID token of the shipment owner>
 *
 * Sends the branded shipment notification email (primary + secondary when
 * provided) for a shipment that has been created and paid for. Idempotent:
 * once the email is accepted, the shipment is marked and later calls are
 * skipped — a retry after a failure re-sends, a duplicate after success does
 * not.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const shipmentId = typeof body?.shipmentId === 'string' ? body.shipmentId.trim() : '';
    const secondaryEmail = typeof body?.secondaryEmail === 'string' ? body.secondaryEmail.trim() : '';

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    if (!shipmentId || !idToken) {
      return NextResponse.json(
        { success: false, code: 'invalid-request', message: 'shipmentId and a bearer token are required.' },
        { status: 400 }
      );
    }

    const result = await sendShipmentNotification(shipmentId, { idToken, secondaryEmail });

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    }

    const status =
      result.code === 'invalid-request' ? 400
      : result.code === 'not-found' ? 404
      : result.code === 'not-authorized' ? 403
      : result.code === 'already-sent' ? 200
      : result.code === 'no-recipients' ? 422
      : result.code === 'not-configured' ? 503
      : result.code === 'send-failed' ? 502
      : 500;

    return NextResponse.json(result, { status });
  } catch (err) {
    console.error('[API /shipments/notify] Unexpected error:', err);
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
