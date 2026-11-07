import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentStatusForTransaction,
  PaymentRouteError,
  verifyPaymentUser,
} from '@/lib/nowpayments-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const decoded = await verifyPaymentUser(request);
    const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim() : '';
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId.trim() : '';

    if (!paymentId || !transactionId) {
      return NextResponse.json(
        { message: 'Payment and transaction references are required.' },
        { status: 400 }
      );
    }

    const status = await getPaymentStatusForTransaction({
      uid: decoded.uid,
      paymentId,
      transactionId,
    });

    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof PaymentRouteError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('[API /payments/status] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Could not check payment status. Please try again.' },
      { status: 500 }
    );
  }
}
