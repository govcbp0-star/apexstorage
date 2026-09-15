import { NextRequest, NextResponse } from 'next/server';
import { sendTwoFAPinResetEmail } from '@/lib/auth-email-service';
import { getAdminAuth, getAdminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { getAppUrl } from '@/lib/resend';
import {
  createTwoFAPinResetToken,
  hashTwoFAPinResetToken,
  TWO_FA_PIN_RESET_COOLDOWN_MS,
  TWO_FA_PIN_RESET_TTL_MS,
  type TwoFAPinResetRecord,
} from '@/lib/twofa-pin-reset';

const RESET_PATH = 'twoFAPinResets';
const TOKEN_INDEX_PATH = 'twoFAPinResetTokenIndex';

function bearerToken(req: NextRequest): string {
  const value = req.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

/**
 * Sends a recovery link only for the Firebase user that has already completed
 * primary sign-in and is waiting at the 2FA PIN screen. The email address is
 * read from Firebase Admin, never accepted from the browser.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { success: false, code: 'not-configured', message: 'The recovery service is unavailable.' },
        { status: 503 },
      );
    }

    const idToken = bearerToken(req);
    if (!idToken) {
      return NextResponse.json(
        { success: false, code: 'unauthorized', message: 'Please sign in again before requesting a reset.' },
        { status: 401 },
      );
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const account = await adminAuth.getUser(decoded.uid);
    if (!account.email) {
      return NextResponse.json(
        { success: false, code: 'unavailable', message: 'This account cannot use PIN recovery.' },
        { status: 400 },
      );
    }

    const database = getAdminDb();
    const profile = (await database.ref('users/' + decoded.uid).get()).val() as {
      twoFAEnabled?: boolean;
      pin2FA?: string;
    } | null;
    if (!profile?.twoFAEnabled || !profile.pin2FA) {
      return NextResponse.json(
        { success: false, code: 'unavailable', message: 'This account does not have a 2FA PIN to reset.' },
        { status: 400 },
      );
    }

    const resetRef = database.ref(RESET_PATH + '/' + decoded.uid);
    const existing = (await resetRef.get()).val() as Partial<TwoFAPinResetRecord> | null;
    const now = Date.now();
    if (typeof existing?.requestedAt === 'number' && now - existing.requestedAt < TWO_FA_PIN_RESET_COOLDOWN_MS) {
      return NextResponse.json(
        { success: false, code: 'too-many-requests', message: 'Please wait a minute before requesting another reset email.' },
        { status: 429 },
      );
    }

    const token = createTwoFAPinResetToken();
    const record: TwoFAPinResetRecord = {
      tokenHash: hashTwoFAPinResetToken(token),
      expiresAt: now + TWO_FA_PIN_RESET_TTL_MS,
      requestedAt: now,
      usedAt: null,
    };
    // Keep a server-only hash index so a link can be resolved without a
    // database scan. Replacing a request also removes its previous index.
    const updates: Record<string, string | TwoFAPinResetRecord | null> = {
      [RESET_PATH + '/' + decoded.uid]: record,
      [TOKEN_INDEX_PATH + '/' + record.tokenHash]: decoded.uid,
    };
    if (typeof existing?.tokenHash === 'string') {
      updates[TOKEN_INDEX_PATH + '/' + existing.tokenHash] = null;
    }
    await database.ref().update(updates);

    const resetUrl = getAppUrl() + '/auth/reset-2fa-pin?token=' + encodeURIComponent(token);
    const result = await sendTwoFAPinResetEmail(account.email, resetUrl);
    if (!result.success) {
      // The token was never delivered. Remove only this request's record so a
      // later attempt is not blocked by a delivery/configuration failure.
      const cleanup = await resetRef.transaction((current: TwoFAPinResetRecord | null) => {
        if (current?.tokenHash === record.tokenHash) return null;
        return;
      });
      if (cleanup.committed) {
        await database.ref(TOKEN_INDEX_PATH + '/' + record.tokenHash).remove();
      }
      return NextResponse.json(
        { success: false, code: result.code || 'server-error', message: 'We could not send the recovery email. Please try again.' },
        { status: result.code === 'not-configured' ? 503 : 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'A secure 2FA PIN reset link has been sent to your registered email address.',
    });
  } catch {
    // Do not log tokens, account identifiers, or email addresses.
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'We could not start PIN recovery. Please try again.' },
      { status: 500 },
    );
  }
}
