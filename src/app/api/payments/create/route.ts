import { NextRequest, NextResponse } from 'next/server';
import {
  createPaymentForTransaction,
  PaymentRouteError,
  verifyPaymentUser,
} from '@/lib/nowpayments-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const decoded = await verifyPaymentUser(request);
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId.trim() : '';
    const payCurrency = typeof body?.payCurrency === 'string' ? body.payCurrency.trim().toLowerCase() : '';

    if (!orderId || !transactionId || !payCurrency) {
      return NextResponse.json(
        { message: 'Order, transaction, and payment currency are required.' },
        { status: 400 }
      );
    }

    const payment = await createPaymentForTransaction({
      uid: decoded.uid,
      orderId,
      transactionId,
      payCurrency,
    });

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof PaymentRouteError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('[API /payments/create] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Could not create the payment. Please try again.' },
      { status: 500 }
    );
  }
}
