import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { PaymentRouteError, verifyPaymentUser } from '@/lib/nowpayments-server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const decoded = await verifyPaymentUser(request);
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId.trim() : '';
    const secondaryEmail = typeof body?.secondaryEmail === 'string' ? body.secondaryEmail.trim().toLowerCase() : '';

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) {
      return NextResponse.json({ message: 'The transaction reference is invalid.' }, { status: 400 });
    }
    if (secondaryEmail && (secondaryEmail.length > 254 || !EMAIL_RE.test(secondaryEmail))) {
      return NextResponse.json({ message: 'Enter a valid notification email address.' }, { status: 400 });
    }

    const transactionRef = getAdminDb().ref(`transactions/${transactionId}`);
    const snapshot = await transactionRef.once('value');
    const transaction = snapshot.val() as {
      userId?: string;
      metadata?: Record<string, unknown>;
    } | null;
    if (!transaction || transaction.userId !== decoded.uid) {
      throw new PaymentRouteError('You cannot update this transaction.', 404);
    }

    await transactionRef.update({
      secondaryEmail,
      metadata: { ...transaction.metadata, secondaryEmail },
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PaymentRouteError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('[API /payments/notification-email] Update failed:', error);
    return NextResponse.json({ message: 'Could not save the notification email.' }, { status: 500 });
  }
}
