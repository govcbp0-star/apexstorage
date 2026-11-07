import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { calculateShipmentFee, goldAssetValueUsd } from '@/lib/shipment-fee';
import { fetchGoldPrice } from '@/lib/gold-price';
import {
  assetIntegrityFields,
  shipmentIntegrityFields,
  signRecordIntegrity,
  verifyRecordIntegrity,
} from '@/lib/record-integrity';
import { RequestAuthError, verifyRequestUser } from '@/lib/server-auth';

const ASSET_TYPES = new Set(['bar', 'coin', 'jewellery']);
const PHONE_RE = /^\+?[\d\s().-]{7,24}$/;

function locationKey(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/[\s_-]+/g, '') : '';
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyRequestUser(request);
    const body = await request.json().catch(() => ({}));
    const assetType = text(body?.assetType, 30).toLowerCase();
    const vaultKey = locationKey(body?.vaultKey);
    const shippingAmount = text(body?.shippingAmount, 20);
    const partialGrams = Number(body?.partialGrams || 0);
    const deliveryName = text(body?.deliveryName, 120);
    const deliveryPhone = text(body?.deliveryPhone, 30);
    const deliveryAddress = text(body?.deliveryAddress, 240);
    const deliveryCity = text(body?.deliveryCity, 100);
    const deliveryPostcode = text(body?.deliveryPostcode, 40);
    const deliveryCountry = text(body?.deliveryCountry, 100);

    if (!ASSET_TYPES.has(assetType) || !vaultKey || !['ship_full', 'ship_partial'].includes(shippingAmount)) {
      return NextResponse.json({ message: 'Choose a valid asset, vault, and shipment amount.' }, { status: 400 });
    }
    if (
      deliveryName.length < 2 ||
      !PHONE_RE.test(deliveryPhone) ||
      deliveryPhone.replace(/\D/g, '').length < 7 ||
      deliveryAddress.length < 5 ||
      !deliveryCity ||
      !deliveryPostcode ||
      !deliveryCountry
    ) {
      return NextResponse.json({ message: 'Enter complete and valid delivery details.' }, { status: 400 });
    }

    const database = getAdminDb();
    const assetsSnapshot = await database.ref('assets').once('value');
    const allAssets = assetsSnapshot.val() as Record<string, Record<string, unknown>> | null;
    const selectedAssets = Object.entries(allAssets || {})
      .filter(([id, asset]) => {
        return asset.userId === decoded.uid && asset.status === 'active' &&
          String(asset.type || '').toLowerCase() === assetType &&
          locationKey(asset.vaultLocation) === vaultKey &&
          asset.recordVersion === 1 &&
          verifyRecordIntegrity(
            'asset',
            assetIntegrityFields({ ...asset, id: typeof asset.id === 'string' ? asset.id : id }),
            asset.recordIntegrity
          );
      })
      .map(([id, asset]) => ({
        id,
        ref: typeof asset.ref === 'string' ? asset.ref : '',
        weight: Number(asset.weight),
        vaultLocation: typeof asset.vaultLocation === 'string' ? asset.vaultLocation : '',
      }))
      .filter((asset) => Number.isFinite(asset.weight) && asset.weight > 0);

    const totalWeight = selectedAssets.reduce((total, asset) => total + asset.weight, 0);
    if (!selectedAssets.length || totalWeight < 1000) {
      return NextResponse.json({ message: 'This vault location does not have enough eligible assets to ship.' }, { status: 409 });
    }

    let weight: number;
    let normalizedPartialGrams = 0;
    if (shippingAmount === 'ship_full') {
      weight = totalWeight;
    } else {
      if (!Number.isFinite(partialGrams) || partialGrams <= 0 || partialGrams > totalWeight) {
        return NextResponse.json({ message: 'Enter a valid partial shipment weight.' }, { status: 400 });
      }
      const minimumWeight = Math.ceil(totalWeight * 0.25);
      if (partialGrams < minimumWeight) {
        return NextResponse.json({ message: `The minimum partial shipment is ${minimumWeight}g.` }, { status: 400 });
      }
      weight = partialGrams;
      normalizedPartialGrams = partialGrams;
    }

    const goldPrice = (await fetchGoldPrice()).price;
    if (!Number.isFinite(goldPrice) || goldPrice <= 0) {
      return NextResponse.json({ message: 'Gold pricing is temporarily unavailable.' }, { status: 503 });
    }

    const shipmentFee = calculateShipmentFee(weight, goldPrice);
    const goldValue = Math.round(goldAssetValueUsd(weight, goldPrice) * 100) / 100;
    const profileSnapshot = await database.ref(`users/${decoded.uid}`).once('value');
    const profile = profileSnapshot.val() as { name?: string } | null;
    const email = decoded.email || '';
    const userName = profile?.name?.trim() || decoded.name || email.split('@')[0] || 'Customer';
    const now = new Date().toISOString();
    const shipmentId = `${decoded.uid}_shipment_${crypto.randomUUID().replace(/-/g, '')}`;
    const transactionId = database.ref('transactions').push().key;
    if (!transactionId) throw new Error('Could not allocate a transaction reference.');

    const assetId = selectedAssets.map((asset) => asset.id).join(',');
    const assetRef = selectedAssets.map((asset) => asset.ref).filter(Boolean).join(', ');
    const vaultLocation = selectedAssets[0]?.vaultLocation || vaultKey;
    const description = `Shipment: ${deliveryCity}, ${deliveryCountry}`;
    const shipment = {
      id: shipmentId,
      userName,
      userId: decoded.uid,
      userEmail: email,
      assetType,
      assetRef,
      assetId,
      shippingAmount,
      partialGrams: normalizedPartialGrams,
      deliveryName,
      deliveryPhone,
      deliveryAddress,
      deliveryCity,
      deliveryPostcode,
      deliveryCountry,
      weight,
      shipmentFee,
      vaultLocation,
      goldPrice,
      goldValue,
      paymentMethod: 'crypto',
      paymentStatus: 'pending',
      transactionId,
      recordVersion: 1,
      status: 'pending',
      date: now.slice(0, 10),
      createdAt: now,
    };
    const recordIntegrity = signRecordIntegrity('shipment', shipmentIntegrityFields(shipment));
    const transaction = {
      id: transactionId,
      userId: decoded.uid,
      userEmail: email,
      userName,
      type: 'shipment',
      description,
      amount: shipmentFee,
      currency: 'usd',
      cryptoCurrency: '',
      cryptoAmount: 0,
      paymentId: '',
      paymentStatus: 'pending',
      shipmentId,
      metadata: { orderId: shipmentId },
      createdAt: now,
      updatedAt: now,
    };

    await database.ref().update({
      [`shipments/${shipmentId}`]: { ...shipment, recordIntegrity },
      [`transactions/${transactionId}`]: transaction,
    });

    return NextResponse.json({
      shipmentId,
      transactionId,
      amount: shipmentFee,
      weight,
      goldPrice,
      goldValue,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('[API /shipments] Shipment creation failed:', error);
    return NextResponse.json({ message: 'Could not create the shipment. Please try again.' }, { status: 500 });
  }
}
