import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTwoFAPinResetToken,
  hashTwoFAPin,
  hashTwoFAPinResetToken,
  isUsableTwoFAPinReset,
  isValidTwoFAPin,
  tokenHashesMatch,
} from './twofa-pin-reset.ts';

describe('2FA PIN reset helpers', () => {
  it('accepts only 4 to 6 numeric PINs', () => {
    assert.equal(isValidTwoFAPin('1234'), true);
    assert.equal(isValidTwoFAPin('123456'), true);
    assert.equal(isValidTwoFAPin('123'), false);
    assert.equal(isValidTwoFAPin('1234567'), false);
    assert.equal(isValidTwoFAPin('12a4'), false);
  });

  it('creates an opaque token and stores only a matching hash', () => {
    const token = createTwoFAPinResetToken();
    const hash = hashTwoFAPinResetToken(token);
    assert.match(token, /^[A-Za-z0-9_-]{40,128}$/);
    assert.notEqual(hash, token);
    assert.equal(tokenHashesMatch(token, hash), true);
    assert.equal(tokenHashesMatch(createTwoFAPinResetToken(), hash), false);
  });

  it('rejects expired, used, and incorrect-token reset records', () => {
    const token = createTwoFAPinResetToken();
    const now = 1_700_000_000_000;
    const record = {
      tokenHash: hashTwoFAPinResetToken(token),
      requestedAt: now - 1_000,
      expiresAt: now + 1_000,
      usedAt: null,
    };
    assert.equal(isUsableTwoFAPinReset(record, token, now), true);
    assert.equal(isUsableTwoFAPinReset({ ...record, expiresAt: now }, token, now), false);
    assert.equal(isUsableTwoFAPinReset({ ...record, usedAt: now }, token, now), false);
    assert.equal(isUsableTwoFAPinReset(record, createTwoFAPinResetToken(), now), false);
  });

  it('keeps recovered PIN hashes compatible with the browser hashPin() format (hex)', () => {
    // Same digest the WebCrypto-based hashPin() produces for '1234'.
    assert.equal(hashTwoFAPin('1234'), '526dd3c53a2b6a77d30974ca6430c89d223a4ba0fc4de1c91d1d52a82256c073');
  });
});
