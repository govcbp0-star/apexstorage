import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendWelcomeEmail, markWelcomeSent } from '@/lib/auth-email-service';

/**
 * POST /api/auth/ensure-welcome
 * Body: { email: string }
 *
 * Idempotent catch-up: guarantees a VERIFIED account has received exactly one
 * branded welcome email, regardless of HOW it was verified. This closes the
 * gaps where the primary flow never runs — e.g. accounts verified through the
 * old hosted-page flow (handleCodeInApp:false), a transient welcome-send
 * failure in /api/auth/verify-code, a request dropped between Firebase and
 * the app, or Google sign-ins (which are verified by the provider).
 *
 *   * account not found          → 404 user-not-found
 *   * account not emailVerified  → 400 not-verified (nothing to welcome yet)
 *   * welcome already delivered  → 200 { skipped: 'already-sent' }
 *   * verified, never welcomed   → sends welcome, records delivery → 200 { sent: true }
 *
 * The delivery record is a Firebase custom claim (`welcomeSent`) written by
 * markWelcomeSent() — the SAME marker the primary verify-code flow writes —
 * so the normal path and this fallback share one source of truth and can
 * never double-send. The claim is only written AFTER Resend accepts the
 * email, so a transient delivery failure is retried on the user's next
 * sign-in instead of being silently lost. Never logs the email beyond the
 * recipient itself, and never logs any secret.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json(
        { success: false, code: 'invalid-email', message: 'Invalid email address.' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    type UserRecord = Awaited<ReturnType<typeof adminAuth.getUserByEmail>>;
    let user: UserRecord;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        return NextResponse.json(
          { success: false, code: 'user-not-found', message: 'No account found with this email.' },
          { status: 404 }
        );
      }
      throw err;
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { success: false, code: 'not-verified', message: 'This account has not verified its email yet.' },
        { status: 400 }
      );
    }

    const claims = (user.customClaims || {}) as Record<string, unknown>;
    if (claims.welcomeSent === true) {
      return NextResponse.json({ success: true, skipped: 'already-sent' }, { status: 200 });
    }

    const result = await sendWelcomeEmail(user.email || email, user.displayName || '');
    if (!result.success) {
      console.error('[API /auth/ensure-welcome] Welcome email failed:', {
        email: user.email || email,
        code: result.code,
        message: result.message,
      });
      return NextResponse.json(
        { success: false, code: 'send-failed', message: result.message },
        { status: 502 }
      );
    }

    // Claim set only after the email is accepted — a failed send must retry.
    await markWelcomeSent(user.uid).catch((err) =>
      console.error('[API /auth/ensure-welcome] Failed to record delivery:', err)
    );

    return NextResponse.json(
      { success: true, sent: true, email: user.email || email },
      { status: 200 }
    );
  } catch (err) {
    console.error('[API /auth/ensure-welcome] Unexpected error:', err);
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
