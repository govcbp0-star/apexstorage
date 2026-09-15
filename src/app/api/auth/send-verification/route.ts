import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/auth-email-service';

/**
 * POST /api/auth/send-verification
 * Body: { email: string }
 *
 * Generates a Firebase email-verification link via the Admin SDK
 * and delivers the branded APEXSTORAGE verification email via Resend.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    const result = await sendVerificationEmail(email);
    const status = result.success
      ? 200
      : result.code === 'invalid-email'
        ? 400
        : result.code === 'user-not-found'
          ? 404
          : result.code === 'too-many-requests'
            ? 429
            : result.code === 'not-configured'
              ? 503
              : 500;

    return NextResponse.json(result, { status });
  } catch (err) {
    console.error('[API /auth/send-verification] Unexpected error:', err);
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'Failed to send verification email. Please try again.' },
      { status: 500 }
    );
  }
}
