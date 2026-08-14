import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateShipmentFee, goldAssetValueUsd, GRAMS_PER_TROY_OUNCE } from './shipment-fee.ts';
import { SHIPMENT_FEE_RATE } from './constants.ts';

describe('goldAssetValueUsd', () => {
  it('converts grams to troy ounces and multiplies by the price per ounce', () => {
    const expected = (1000 / GRAMS_PER_TROY_OUNCE) * 5000;
    assert.equal(goldAssetValueUsd(1000, 5000), expected);
  });

  it('zero weight yields zero value', () => {
    assert.equal(goldAssetValueUsd(0, 5000), 0);
  });
});

describe('calculateShipmentFee', () => {
  it('uses the shared 0.15% rate constant as its single source of truth', () => {
    assert.equal(SHIPMENT_FEE_RATE, 0.0015);
  });

  it('matches live-verified values from the shipment wizard', () => {
    // 1500 g @ $4,308.13/oz -> shown in the wizard as "$312.00"
    assert.equal(calculateShipmentFee(1500, 4308.13), 312);
    // 123.4 g @ $4,744.08/oz -> shown in the shipment email as "$29.00"
    assert.equal(calculateShipmentFee(123.4, 4744.08), 29);
  });

  it('rounds UP to the nearest whole dollar (never under-collects)', () => {
    // The fee is always >= the raw percentage product and < product + 1.
    for (const [weight, price] of [[1500, 4308.13], [123.4, 4744.08], [500, 5000], [31.1, 4310.41], [2500, 3100]] as const) {
      const raw = goldAssetValueUsd(weight, price) * SHIPMENT_FEE_RATE;
      const fee = calculateShipmentFee(weight, price);
      assert.ok(fee >= raw, `fee ${fee} should be >= raw ${raw}`);
      assert.ok(fee < raw + 1, `fee ${fee} should be < raw+1 ${raw + 1}`);
    }
  });

  it('zero weight yields a zero fee', () => {
    assert.equal(calculateShipmentFee(0, 4744.08), 0);
  });
});
