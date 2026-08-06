import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/auth-email-service';

/**
 * POST /api/auth/welcome
 * Body: { email: string, name?: string }
 *
 * Sends the branded welcome email after successful email verification.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    const result = await sendWelcomeEmail(email, name);
    const status = result.success
      ? 200
      : result.code === 'invalid-email'
        ? 400
        : result.code === 'not-configured'
          ? 503
          : 500;

    return NextResponse.json(result, { status });
  } catch (err) {
    console.error('[API /auth/welcome] Unexpected error:', err);
    return NextResponse.json(
      { success: false, code: 'server-error', message: 'Failed to send welcome email.' },
      { status: 500 }
    );
  }
}
