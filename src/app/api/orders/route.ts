import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { fetchGoldPrice } from '@/lib/gold-price';
import { goldOrderIntegrityFields, signRecordIntegrity } from '@/lib/record-integrity';
import { RequestAuthError, verifyRequestUser } from '@/lib/server-auth';

const GRAMS_PER_TROY_OUNCE = 31.1035;
const ALLOWED_PRODUCTS = new Set(['bar', 'coin', 'jewellery']);
const ALLOWED_VAULTS = new Set(['zurich', 'singapore', 'london', 'newyork']);

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyRequestUser(request);
    const body = await request.json().catch(() => ({}));
    const productType = typeof body?.productType === 'string' ? body.productType.trim().toLowerCase() : '';
    const vault = typeof body?.vault === 'string' ? body.vault.trim().toLowerCase() : '';
    const quantityOz = Number(body?.quantityOz);

    if (!ALLOWED_PRODUCTS.has(productType) || !ALLOWED_VAULTS.has(vault)) {
      return NextResponse.json({ message: 'Choose a valid gold product and vault.' }, { status: 400 });
    }
    if (!Number.isFinite(quantityOz) || quantityOz < 0.001 || quantityOz > 1000) {
      return NextResponse.json({ message: 'Enter an order quantity between 0.001 and 1,000 ounces.' }, { status: 400 });
    }

    const goldPrice = (await fetchGoldPrice()).price;
    if (!Number.isFinite(goldPrice) || goldPrice <= 0) {
      return NextResponse.json({ message: 'Gold pricing is temporarily unavailable.' }, { status: 503 });
    }

    const database = getAdminDb();
    const profileSnapshot = await database.ref(`users/${decoded.uid}`).once('value');
    const profile = profileSnapshot.val() as { name?: string } | null;
    const email = decoded.email || '';
    const userName = profile?.name?.trim() || decoded.name || email.split('@')[0] || 'Customer';
    const now = new Date().toISOString();
    const orderId = `${decoded.uid}_order_${crypto.randomUUID().replace(/-/g, '')}`;
    const transactionId = database.ref('transactions').push().key;
    if (!transactionId) throw new Error('Could not allocate a transaction reference.');

    const quantityGrams = Number((quantityOz * GRAMS_PER_TROY_OUNCE).toFixed(2));
    const normalizedOz = Number(quantityOz.toFixed(6));
    const estimatedTotal = Math.round(normalizedOz * goldPrice * 100) / 100;
    const description = `Buy ${productType} - ${quantityGrams}g`;
    const order = {
      id: orderId,
      userName,
      userId: decoded.uid,
      userEmail: email,
      type: 'Buy Gold',
      productType,
      quantityGrams,
      quantityOz: normalizedOz,
      vault,
      goldPrice,
      estimatedTotal,
      status: 'pending',
      paymentMethod: 'crypto',
      paymentStatus: 'pending',
      transactionId,
      recordVersion: 1,
      date: now.slice(0, 10),
      createdAt: now,
    };
    const orderFields = goldOrderIntegrityFields(order);
    const recordIntegrity = signRecordIntegrity('gold-order', orderFields);

    const transaction = {
      id: transactionId,
      userId: decoded.uid,
      userEmail: email,
      userName,
      type: 'gold_purchase',
      description,
      amount: estimatedTotal,
      currency: 'usd',
      cryptoCurrency: '',
      cryptoAmount: 0,
      paymentId: '',
      paymentStatus: 'pending',
      orderId,
      metadata: { orderId },
      createdAt: now,
      updatedAt: now,
    };

    await database.ref().update({
      [`orders/${orderId}`]: { ...order, recordIntegrity },
      [`transactions/${transactionId}`]: transaction,
    });

    return NextResponse.json({
      orderId,
      transactionId,
      amount: estimatedTotal,
      quantityGrams,
      quantityOz: normalizedOz,
      goldPrice,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('[API /orders] Order creation failed:', error);
    return NextResponse.json({ message: 'Could not create the order. Please try again.' }, { status: 500 });
  }
}
