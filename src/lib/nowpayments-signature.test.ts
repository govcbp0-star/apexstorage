import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  buildWebhookSignatureBody,
  computeWebhookSignature,
  verifyWebhookSignature,
  normalizePaymentStatus,
} from './nowpayments-signature.ts';

const SECRET = 'test-ipn-secret';
const BODY = {
  payment_id: 'p-123',
  payment_status: 'finished',
  order_id: 'o-456',
  pay_amount: 100,
  pay_currency: 'usdt',
};

describe('normalizePaymentStatus', () => {
  it('maps final success states to confirmed', () => {
    assert.equal(normalizePaymentStatus('finished'), 'confirmed');
    assert.equal(normalizePaymentStatus('confirmed'), 'confirmed');
  });

  it('maps failures and refunds to failed', () => {
    assert.equal(normalizePaymentStatus('failed'), 'failed');
    assert.equal(normalizePaymentStatus('refunded'), 'failed');
  });

  it('maps expired', () => {
    assert.equal(normalizePaymentStatus('expired'), 'expired');
  });

  it('keeps intermediate/unknown states pending', () => {
    assert.equal(normalizePaymentStatus('sending'), 'pending');
    assert.equal(normalizePaymentStatus('confirming'), 'pending');
    assert.equal(normalizePaymentStatus('waiting'), 'pending');
    assert.equal(normalizePaymentStatus(''), 'pending');
  });
});

describe('buildWebhookSignatureBody', () => {
  it('re-serializes the body with keys sorted lexicographically', () => {
    const canonical = buildWebhookSignatureBody(BODY);
    assert.deepEqual(JSON.parse(canonical), BODY);
    // The canonical string must start with the lexicographically first key.
    assert.ok(canonical.startsWith('{"order_id":'));
    assert.ok(canonical.indexOf('"pay_amount"') < canonical.indexOf('"payment_id"'));
  });
});

describe('computeWebhookSignature / verifyWebhookSignature', () => {
  it('computes the same HMAC-SHA512 the route originally produced', () => {
    const expected = createHmac('sha512', SECRET)
      .update(JSON.stringify(BODY, Object.keys(BODY).sort()))
      .digest('hex');
    assert.equal(computeWebhookSignature(SECRET, BODY), expected);
  });

  it('accepts a valid signature', () => {
    const sig = computeWebhookSignature(SECRET, BODY);
    assert.equal(verifyWebhookSignature(SECRET, BODY, sig), true);
  });

  it('rejects a tampered payload', () => {
    const sig = computeWebhookSignature(SECRET, BODY);
    const tampered = { ...BODY, payment_status: 'failed' };
    assert.equal(verifyWebhookSignature(SECRET, tampered, sig), false);
  });

  it('rejects a payload signed with a different secret', () => {
    const wrong = computeWebhookSignature('another-secret', BODY);
    assert.equal(verifyWebhookSignature(SECRET, BODY, wrong), false);
  });

  it('rejects missing, empty, or malformed signatures', () => {
    assert.equal(verifyWebhookSignature(SECRET, BODY, ''), false);
    assert.equal(verifyWebhookSignature(SECRET, BODY, 'deadbeef'), false);
    assert.equal(verifyWebhookSignature(SECRET, BODY, 'zzzz'), false);
    assert.equal(verifyWebhookSignature('', BODY, computeWebhookSignature('', BODY)), false);
  });
});
