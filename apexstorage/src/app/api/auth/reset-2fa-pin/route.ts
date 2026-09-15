import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, isAdminConfigured } from '@/lib/firebase-admin';
import {
  hashTwoFAPin,
  hashTwoFAPinResetToken,
  isUsableTwoFAPinReset,
  isValidTwoFAPin,
  type TwoFAPinResetRecord,
} from '@/lib/twofa-pin-reset';

const RESET_PATH = 'twoFAPinResets';
const TOKEN_INDEX_PATH = 'twoFAPinResetTokenIndex';

function invalidLink() {
  return NextResponse.json(
    {
      success: false,
      code: 'invalid-token',
      message: 'This 2FA PIN reset link is invalid, expired, or has already been used.',
    },
    { status: 400 },
  );
}

/**
 * Validate a recovery link without consuming it, or atomically consume the
 * link and update the PIN. The raw token is never stored or logged.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { success: false, code: 'not-configured', message: 'The recovery service is unavailable.' },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token : '';
    const newPin = typeof body?.newPin === 'string' ? body.newPin : '';
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) return invalidLink();

    const database = getAdminDb();
    const tokenHash = hashTwoFAPinResetToken(token);
    const uid = (await database.ref(TOKEN_INDEX_PATH + '/' + tokenHash).get()).val();
    if (typeof uid !== 'string' || !uid) return invalidLink();
    const resetRecord = (await database.ref(RESET_PATH + '/' + uid).get()).val() as TwoFAPinResetRecord | null;
    if (!isUsableTwoFAPinReset(resetRecord, token)) return invalidLink();

    // A request without a new PIN is a non-consuming validity check used by
    // the page before it presents the form.
    if (!newPin) return NextResponse.json({ success: true, mode: 'verify' });

    if (!isValidTwoFAPin(newPin)) {
      return NextResponse.json(
        { success: false, code: 'invalid-pin', message: 'PIN must contain 4 to 6 digits.' },
        { status: 400 },
      );
    }

    const newPinHash = hashTwoFAPin(newPin);
    const userRef = database.ref('users/' + uid);
    const currentProfile = (await userRef.get()).val() as { pin2FA?: string } | null;
    if (!currentProfile?.pin2FA) return invalidLink();
    if (currentProfile.pin2FA === newPinHash) {
      return NextResponse.json(
        { success: false, code: 'same-pin', message: 'Choose a PIN that is different from your current PIN.' },
        { status: 400 },
      );
    }

    // Re-check inside a transaction so concurrent requests cannot consume the
    // same reset link. A failed update leaves the link consumed, which is
    // safer than allowing a potentially replayable token.
    const tokenRef = database.ref(RESET_PATH + '/' + uid);
    const consumed = await tokenRef.transaction((current: TwoFAPinResetRecord | null) => {
      if (!isUsableTwoFAPinReset(current, token)) return;
      return { ...current, usedAt: Date.now() };
    });
    if (!consumed.committed) return invalidLink();

    await userRef.update({ pin2FA: newPinHash });
    await database.ref(TOKEN_INDEX_PATH + '/' + tokenHash).remove();
    return NextResponse.json({ success: true, mode: 'reset' });
  } catch {
    // Do not log raw recovery tokens or PIN values.
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'We could not reset your 2FA PIN. Please try again.' },
      { status: 500 },
    );
  }
}
