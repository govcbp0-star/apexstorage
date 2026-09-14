import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendWelcomeEmail, markWelcomeSent } from '@/lib/auth-email-service';

const WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

/**
 * POST /api/auth/verify-code
 * Body: { oobCode?: string, email?: string }
 *
 * Applies a Firebase email-verification action code IN-APP (the links are
 * generated with handleCodeInApp:true, so they land on /auth/verified with
 * ?mode=verifyEmail&oobCode=... on ANY device/browser).
 *
 * The Firebase Admin SDK has no method to consume action codes, so this route
 * calls the identitytoolkit REST endpoint `accounts:update` — the exact call
 * the JS SDK's applyActionCode() performs under the hood. Running it
 * server-side is more robust than the client SDK: it works even when the
 * browser cannot reach Firebase directly, and the verified email returned by
 * the response lets us send the branded welcome email in the same request.
 *
 * Replay safety: a consumed/expired code (duplicate click or a second device
 * opening the same link) is detected via the REST error, and if the fallback
 * email's account is already verified we report success WITHOUT re-sending the
 * welcome email (it was delivered when the code was first applied).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const oobCode = typeof body?.oobCode === 'string' ? body.oobCode.trim() : '';
    const fallbackEmail = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!oobCode && !fallbackEmail) {
      return NextResponse.json(
        { success: false, code: 'invalid-code', message: 'Missing verification code.' },
        { status: 400 }
      );
    }

    let verifiedEmail = '';
    // The welcome email is only sent when a code is successfully applied in
    // THIS request. Fallback paths (replay / no-code) never send it — the
    // welcome was already delivered when the code was first applied.
    let appliedInRequest = false;

    if (oobCode) {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.emailVerified) {
        verifiedEmail = typeof data.email === 'string' ? data.email : '';
        appliedInRequest = true;
      } else {
        const firebaseErr = (data?.error?.message || 'UNKNOWN') as string;
        const errCode = firebaseErr.split(' ')[0];
        console.error('[API /auth/verify-code] Firebase rejected code:', { errCode, message: firebaseErr });

        if (errCode === 'INVALID_OOB_CODE' || errCode === 'EXPIRED_OOB_CODE') {
          // Code already consumed or expired. If we still know the account and it
          // IS verified, this is a replay of an already-completed verification —
          // report success without sending a duplicate welcome email.
          if (fallbackEmail) {
            try {
              const user = await getAdminAuth().getUserByEmail(fallbackEmail);
              if (user.emailVerified) {
                return NextResponse.json(
                  { success: true, alreadyVerified: true, email: user.email },
                  { status: 200 }
                );
              }
            } catch {
              // User not found — fall through to the generic error below.
            }
          }
          return NextResponse.json(
            {
              success: false,
              code: errCode === 'EXPIRED_OOB_CODE' ? 'expired-code' : 'invalid-code',
              message:
                errCode === 'EXPIRED_OOB_CODE'
                  ? 'This verification link has expired. Please request a new one.'
                  : 'This verification link is invalid or has already been used. If you verified your email on another device, you can simply sign in.',
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            code: 'verify-failed',
            message: 'We could not verify your email. Please request a new verification link.',
          },
          { status: 400 }
        );
      }
    }

    // No code (or code consumed) — confirm via the known account that the email
    // is actually verified before reporting success.
    if (!verifiedEmail && fallbackEmail) {
      try {
        const user = await getAdminAuth().getUserByEmail(fallbackEmail);
        if (user.emailVerified) verifiedEmail = user.email || '';
      } catch {
        // ignore — verifiedEmail stays empty
      }
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        {
          success: false,
          code: 'verify-failed',
          message: 'We could not verify your email. Please request a new verification link.',
        },
        { status: 400 }
      );
    }

    // Verification succeeded — deliver the branded welcome email (best-effort),
    // but only when a code was applied in this request. The account is
    // verified regardless of email delivery outcome.
    let welcomeSent = false;
    if (appliedInRequest) {
      let name = '';
      let uid = '';
      try {
        const user = await getAdminAuth().getUserByEmail(verifiedEmail);
        name = user.displayName || '';
        uid = user.uid;
      } catch {
        // name stays '' — the template falls back gracefully.
      }
      const welcome = await sendWelcomeEmail(verifiedEmail, name);
      welcomeSent = welcome.success;
      if (welcomeSent && uid) {
        // Record delivery so the ensure-welcome fallback never re-sends.
        await markWelcomeSent(uid).catch((err) =>
          console.error('[API /auth/verify-code] Failed to record welcome as delivered:', err)
        );
      }
      if (!welcome.success) {
        console.error('[API /auth/verify-code] Welcome email failed:', {
          email: verifiedEmail,
          code: welcome.code,
          message: welcome.message,
        });
      }
    } else {
      console.info('[API /auth/verify-code] No code applied in request — welcome email skipped:', {
        email: verifiedEmail,
      });
    }

    return NextResponse.json(
      { success: true, email: verifiedEmail, welcomeSent },
      { status: 200 }
    );
  } catch (err) {
    console.error('[API /auth/verify-code] Unexpected error:', err);
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
