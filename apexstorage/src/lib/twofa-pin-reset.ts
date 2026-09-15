import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const TWO_FA_PIN_MIN_LENGTH = 4;
export const TWO_FA_PIN_MAX_LENGTH = 6;
export const TWO_FA_PIN_RESET_TTL_MS = 60 * 60 * 1000;
export const TWO_FA_PIN_RESET_COOLDOWN_MS = 60 * 1000;

export interface TwoFAPinResetRecord {
  tokenHash: string;
  expiresAt: number;
  requestedAt: number;
  usedAt: number | null;
}

export function isValidTwoFAPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * MUST match the browser-side hashPin() in auth-context byte-for-byte:
 * SHA-256 of "<pin>apex-vault-2fa-salt", hex-encoded. verify2FAPin() compares
 * hex digests, so a hex-mismatched encoding (e.g. base64) would make every
 * recovered PIN fail verification and lock the account out. The reset route
 * is still server-authorized; the PIN is never included in a URL or
 * persisted in plain text.
 */
export function hashTwoFAPin(pin: string): string {
  return createHash('sha256').update(pin + 'apex-vault-2fa-salt').digest('hex');
}

export function createTwoFAPinResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTwoFAPinResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenHashesMatch(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashTwoFAPinResetToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isUsableTwoFAPinReset(
  record: Partial<TwoFAPinResetRecord> | null | undefined,
  token: string,
  now = Date.now(),
): record is TwoFAPinResetRecord {
  return Boolean(
    record &&
      typeof record.tokenHash === 'string' &&
      typeof record.expiresAt === 'number' &&
      typeof record.requestedAt === 'number' &&
      record.usedAt == null &&
      record.expiresAt > now &&
      tokenHashesMatch(token, record.tokenHash),
  );
}
