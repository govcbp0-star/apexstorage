import { SHIPMENT_FEE_RATE } from './constants.ts';

/**
 * Troy ounces per gram — the industry-standard conversion used for gold
 * valuation across the app (asset value, fees, portfolio charts).
 */
export const GRAMS_PER_TROY_OUNCE = 31.1035;

/**
 * USD value of `weightGrams` of gold at `goldPriceUsdPerOz`.
 *
 * Pure function — the single calculation the shipment wizard (and the
 * persisted `goldValue`) uses, so the fee and its display can never drift.
 */
export function goldAssetValueUsd(weightGrams: number, goldPriceUsdPerOz: number): number {
  return (weightGrams / GRAMS_PER_TROY_OUNCE) * goldPriceUsdPerOz;
}

/**
 * Shipment fee for `weightGrams` at `goldPriceUsdPerOz`: `SHIPMENT_FEE_RATE`
 * (0.15%) of the asset value, rounded UP to the nearest whole dollar.
 *
 * Rounding matches the wizard's historical behavior (`Math.ceil`) — the fee
 * is never less than the raw percentage so APEXSTORAGE never under-collects.
 */
export function calculateShipmentFee(weightGrams: number, goldPriceUsdPerOz: number): number {
  return Math.ceil(goldAssetValueUsd(weightGrams, goldPriceUsdPerOz) * SHIPMENT_FEE_RATE);
}
