import { NextRequest, NextResponse } from 'next/server';

const WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

/**
 * POST /api/auth/reset-password-code
 * Body: { oobCode: string, newPassword?: string }
 *
 * Completes a Firebase password reset IN-APP. The branded reset email link is
 * generated with handleCodeInApp:true, so clicking it lands on
 * /auth/reset-password?mode=resetPassword&oobCode=... on ANY device/browser.
 *
 * This route calls Firebase's identitytoolkit REST endpoint `accounts:resetPassword`
 * — the exact operation the JS SDK's confirmPasswordReset() performs — so the
 * password change is 100% Firebase Authentication (no custom auth backend, no
 * password storage, no bypass of Firebase's code verification).
 *
 *   * Without newPassword: verifies the code and returns the associated email.
 *     (accounts:resetPassword validates an oobCode when no new password is sent.)
 *   * With newPassword: applies the password change. Firebase validates the
 *     code AND the password strength itself.
 *
 * NEVER log the oobCode or the password. Only Firebase's error message token
 * (e.g. INVALID_OOB_CODE) is logged — it contains neither.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const oobCode = typeof body?.oobCode === 'string' ? body.oobCode.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!oobCode) {
      return NextResponse.json(
        { success: false, code: 'invalid-code', message: 'Missing password reset code.' },
        { status: 400 }
      );
    }

    const payload: Record<string, string> = { oobCode };
    const isApply = newPassword.length > 0;

    // Enforce the app-wide password policy server-side (8–128, matching the
    // register/login forms). Firebase's own minimum is 6, which is weaker — a
    // caller with a valid code must not be able to set a shorter password by
    // POSTing to this API directly.
    if (isApply && (newPassword.length < 8 || newPassword.length > 128)) {
      return NextResponse.json(
        {
          success: false,
          code: 'weak-password',
          message: 'Password must be between 8 and 128 characters.',
        },
        { status: 400 }
      );
    }

    if (isApply) payload.newPassword = newPassword;

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return NextResponse.json(
        {
          success: true,
          mode: isApply ? 'reset' : 'verify',
          email: typeof data.email === 'string' ? data.email : '',
        },
        { status: 200 }
      );
    }

    const fbMsg = (data?.error?.message || 'UNKNOWN') as string;
    const errCode = fbMsg.split(' ')[0];
    console.error('[API /auth/reset-password-code] Firebase rejected:', { errCode, message: fbMsg });

    if (errCode === 'INVALID_OOB_CODE' || errCode === 'EXPIRED_OOB_CODE') {
      return NextResponse.json(
        {
          success: false,
          code: 'invalid-code',
          message: 'This password reset link is invalid or has expired. Please request a new password reset link.',
        },
        { status: 400 }
      );
    }
    if (errCode === 'WEAK_PASSWORD') {
      return NextResponse.json(
        {
          success: false,
          code: 'weak-password',
          message: 'This password is too weak. Please use at least 8 characters.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: 'reset-failed',
        message: 'We could not reset your password. Please request a new password reset link.',
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('[API /auth/reset-password-code] Unexpected error:', err);
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
