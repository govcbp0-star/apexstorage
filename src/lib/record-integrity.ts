import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface GoldOrderIntegrityRecord {
  id?: unknown;
  userId?: unknown;
  transactionId?: unknown;
  productType?: unknown;
  quantityGrams?: unknown;
  quantityOz?: unknown;
  vault?: unknown;
  goldPrice?: unknown;
  estimatedTotal?: unknown;
  createdAt?: unknown;
}

export interface AssetIntegrityRecord {
  id?: unknown;
  userId?: unknown;
  ref?: unknown;
  type?: unknown;
  weight?: unknown;
  status?: unknown;
  vaultLocation?: unknown;
  owner?: unknown;
  createdAt?: unknown;
}

export interface ShipmentIntegrityRecord {
  id?: unknown;
  userId?: unknown;
  transactionId?: unknown;
  assetType?: unknown;
  assetId?: unknown;
  assetRef?: unknown;
  shippingAmount?: unknown;
  partialGrams?: unknown;
  weight?: unknown;
  vaultLocation?: unknown;
  shipmentFee?: unknown;
  goldPrice?: unknown;
  goldValue?: unknown;
  deliveryName?: unknown;
  deliveryPhone?: unknown;
  deliveryAddress?: unknown;
  deliveryCity?: unknown;
  deliveryPostcode?: unknown;
  deliveryCountry?: unknown;
  createdAt?: unknown;
}

function integrityKey(): string {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n');
  if (!privateKey) throw new Error('Firebase server credentials are not configured.');
  return privateKey;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

export function assetIntegrityFields(record: AssetIntegrityRecord) {
  return {
    id: asString(record.id),
    userId: asString(record.userId),
    ref: asString(record.ref),
    type: asString(record.type),
    weight: asNumber(record.weight),
    status: asString(record.status),
    vaultLocation: asString(record.vaultLocation),
    owner: asString(record.owner),
    createdAt: asString(record.createdAt),
  };
}

export function goldOrderIntegrityFields(record: GoldOrderIntegrityRecord) {
  return {
    userId: asString(record.userId),
    id: asString(record.id),
    transactionId: asString(record.transactionId),
    productType: asString(record.productType),
    quantityGrams: asNumber(record.quantityGrams),
    quantityOz: asNumber(record.quantityOz),
    vault: asString(record.vault),
    goldPrice: asNumber(record.goldPrice),
    estimatedTotal: asNumber(record.estimatedTotal),
    createdAt: asString(record.createdAt),
  };
}

export function shipmentIntegrityFields(record: ShipmentIntegrityRecord) {
  return {
    userId: asString(record.userId),
    id: asString(record.id),
    transactionId: asString(record.transactionId),
    assetType: asString(record.assetType),
    assetId: asString(record.assetId),
    assetRef: asString(record.assetRef),
    shippingAmount: asString(record.shippingAmount),
    partialGrams: asNumber(record.partialGrams),
    weight: asNumber(record.weight),
    vaultLocation: asString(record.vaultLocation),
    shipmentFee: asNumber(record.shipmentFee),
    goldPrice: asNumber(record.goldPrice),
    goldValue: asNumber(record.goldValue),
    deliveryName: asString(record.deliveryName),
    deliveryPhone: asString(record.deliveryPhone),
    deliveryAddress: asString(record.deliveryAddress),
    deliveryCity: asString(record.deliveryCity),
    deliveryPostcode: asString(record.deliveryPostcode),
    deliveryCountry: asString(record.deliveryCountry),
    createdAt: asString(record.createdAt),
  };
}

export function signRecordIntegrity(kind: 'asset' | 'gold-order' | 'shipment', fields: object): string {
  return createHmac('sha256', integrityKey())
    .update(`apexstorage:record-integrity:v1:${kind}:`)
    .update(JSON.stringify(fields))
    .digest('hex');
}

export function verifyRecordIntegrity(
  kind: 'asset' | 'gold-order' | 'shipment',
  fields: object,
  signature: unknown
): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signRecordIntegrity(kind, fields), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
