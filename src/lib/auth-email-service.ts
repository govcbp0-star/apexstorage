import { render } from '@react-email/render';
import * as React from 'react';
import { getAdminAuth, isAdminConfigured } from '@/lib/firebase-admin';
import { assertEmailConfig, getAppUrl, getResend, isPublicWebUrl, EMAIL_FROM, REPLY_TO, SUPPORT_EMAIL } from '@/lib/resend';
import VerifyEmail from '@/lib/email/verify-email';
import ResetPasswordEmail from '@/lib/email/reset-password';
import WelcomeEmail from '@/lib/email/welcome';

/**
 * Central authentication email service — server-only.
 *
 * Every user-facing authentication email is generated here:
 *   1. Firebase Admin SDK securely generates the action link
 *   2. The branded React Email template is rendered to HTML
 *   3. Resend delivers the email
 *
 * The client never touches Firebase's built-in email sending.
 */

export type AuthEmailErrorCode =
  | 'user-not-found'
  | 'invalid-email'
  | 'too-many-requests'
  | 'not-configured'
  | 'server-error';

export interface AuthEmailResult {
  success: boolean;
  code?: AuthEmailErrorCode;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function mapError(err: unknown): AuthEmailResult {
  const code = (err as { code?: string })?.code || '';
  const message = (err as { message?: string })?.message || '';
  // The Admin SDK wraps server responses — the real Firebase error message
  // (e.g. TOO_MANY_ATTEMPTS_TRY_LATER) is nested in err.cause.response.data
  // .error.message while err.message is just the generic "An internal error
  // has occurred."
  const causeMessage =
    (err as { cause?: { response?: { data?: { error?: { message?: string } } } } })?.cause?.response?.data?.error?.message ||
    '';

  if (
    message.includes('not configured') ||
    message.includes('configured correctly') ||
    message.includes('APP_URL is invalid') ||
    message.includes('EMAIL_FROM') ||
    message.includes('SUPPORT_EMAIL') ||
    message.includes('REPLY_TO')
  ) {
    return { success: false, code: 'not-configured', message: 'Email service is not configured.' };
  }
  if (code === 'auth/user-not-found') {
    return { success: false, code: 'user-not-found', message: 'No account found with this email.' };
  }
  if (code === 'auth/invalid-email') {
    return { success: false, code: 'invalid-email', message: 'Invalid email address.' };
  }
  // Firebase surfaces its verification-link rate limit as auth/internal-error
  // with TOO_MANY_ATTEMPTS_TRY_LATER in the message (the Admin SDK does not
  // map it to auth/too-many-requests). Recognize it so the UI can show the
  // friendly "try again later" message instead of a generic failure.
  if (code === 'auth/too-many-requests' || message.includes('TOO_MANY_ATTEMPTS_TRY_LATER') || causeMessage.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
    return { success: false, code: 'too-many-requests', message: 'Too many requests. Please try again later.' };
  }
  return { success: false, code: 'server-error', message: 'Failed to send email. Please try again.' };
}

async function deliver(to: string, subject: string, html: string): Promise<AuthEmailResult> {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    replyTo: REPLY_TO,
    to,
    subject,
    html,
  });
  if (error) {
    console.error('[AuthEmail] Resend delivery failed:', { to, subject, error });
    return { success: false, code: 'server-error', message: 'Failed to send email. Please try again.' };
  }
  if (!data?.id) {
    console.error('[AuthEmail] Resend returned no message id:', { to, subject, data });
    return { success: false, code: 'server-error', message: 'Failed to send email. Please try again.' };
  }
  console.info('[AuthEmail] Resend accepted email:', { to, subject, id: data.id });
  return { success: true, message: 'Email sent successfully.' };
}

function validateRequest(email: string): AuthEmailResult | null {
  if (!email || !EMAIL_RE.test(email)) {
    return { success: false, code: 'invalid-email', message: 'Invalid email address.' };
  }
  if (!isAdminConfigured()) {
    return { success: false, code: 'not-configured', message: 'Email service is not configured.' };
  }
  try {
    assertEmailConfig();
  } catch (err) {
    console.error('[AuthEmail] Configuration validation failed:', err);
    return { success: false, code: 'not-configured', message: 'Email service is not configured.' };
  }
  return null;
}

/** Generate a Firebase email-verification link and deliver the branded email. */
export async function sendVerificationEmail(email: string): Promise<AuthEmailResult> {
  const invalid = validateRequest(email);
  if (invalid) return invalid;

  try {
    const adminAuth = getAdminAuth();
    // Ensures the account exists — throws auth/user-not-found otherwise
    await adminAuth.getUserByEmail(email);
    const continueUrl = `${getAppUrl()}/auth/verified`;
    // handleCodeInApp: true — the link lands on /auth/verified with
    // ?mode=verifyEmail&oobCode=... and the app itself applies the code via
    // POST /api/auth/verify-code (which calls Firebase's REST API, the same
    // operation applyActionCode performs). This lets the app ALWAYS know the
    // verified email (any device/browser) and reliably send the branded
    // welcome email.
    const link = await adminAuth.generateEmailVerificationLink(email, {
      url: continueUrl,
      handleCodeInApp: true,
    });
    console.info('[AuthEmail] Firebase verification link generated:', { email, continueUrl });
    const html = await render(
      React.createElement(VerifyEmail, { verificationUrl: link, supportEmail: SUPPORT_EMAIL })
    );
    const result = await deliver(email, 'Verify Your APEXSTORAGE Account', html);
    if (result.success) result.message = 'Verification email sent successfully.';
    return result;
  } catch (err) {
    console.error('[AuthEmail] sendVerificationEmail failed:', err);
    return mapError(err);
  }
}

/** Generate a Firebase password-reset link and deliver the branded email. */
export async function sendPasswordResetEmailLink(email: string): Promise<AuthEmailResult> {
  const invalid = validateRequest(email);
  if (invalid) return invalid;

  try {
    const adminAuth = getAdminAuth();
    await adminAuth.getUserByEmail(email);
    const continueUrl = `${getAppUrl()}/auth/reset-password`;
    // The Admin SDK generates the link against Firebase's HOSTED action
    // handler (firebaseapp.com/__/auth/action). That hosted page renders its
    // OWN white "reset password" UI for mode=resetPassword instead of
    // redirecting to the app (observed in the served action.js and in real
    // browser tests), so the emailed link must point DIRECTLY at the branded
    // in-app reset page instead. The oobCode below is still Firebase-issued
    // and validated server-side via accounts:resetPassword — the same
    // operation confirmPasswordReset() performs — so this changes only the
    // URL that carries the code, never the security of the reset itself.
    const link = await adminAuth.generatePasswordResetLink(email, {
      url: continueUrl,
      handleCodeInApp: true,
    });
    const oobCode = new URL(link).searchParams.get('oobCode') || '';
    if (!oobCode) {
      throw new Error('Firebase password-reset link did not contain an oobCode.');
    }
    const resetUrl = `${getAppUrl()}/auth/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;
    console.info('[AuthEmail] Firebase password reset link generated:', { email, continueUrl });
    const html = await render(
      React.createElement(ResetPasswordEmail, { resetUrl, supportEmail: SUPPORT_EMAIL })
    );
    const result = await deliver(email, 'Reset Your APEXSTORAGE Password', html);
    if (result.success) result.message = 'Password reset email sent successfully.';
    return result;
  } catch (err) {
    console.error('[AuthEmail] sendPasswordResetEmailLink failed:', err);
    return mapError(err);
  }
}

/** Send the branded welcome email after successful verification (optional flow). */
export async function sendWelcomeEmail(email: string, name: string): Promise<AuthEmailResult> {
  const invalid = validateRequest(email);
  if (invalid) return invalid;

  try {
    // NEVER embed a development/private URL in an outbound email — mailbox
    // providers classify messages linking to localhost/private hosts as spam
    // (this was the exact difference from the verification/reset emails that
    // reach the inbox). When APP_URL is not a real public https URL (e.g. the
    // local dev server), omit the dashboard CTA rather than send a dev link.
    const appUrl = getAppUrl();
    const dashboardUrl = isPublicWebUrl(appUrl) ? `${appUrl}/dashboard/client` : '';
    const html = await render(
      React.createElement(WelcomeEmail, {
        name,
        dashboardUrl,
        supportEmail: SUPPORT_EMAIL,
      })
    );
    const result = await deliver(email, 'Welcome to APEXSTORAGE', html);
    if (result.success) result.message = 'Welcome email sent successfully.';
    return result;
  } catch (err) {
    console.error('[AuthEmail] sendWelcomeEmail failed:', err);
    return mapError(err);
  }
}

/**
 * Record that the welcome email has been delivered for a user.
 *
 * Stored as a Firebase custom claim (`welcomeSent`) so the idempotent
 * ensure-welcome fallback can never double-send. Claims are written via the
 * Admin SDK — no RTDB permission rules involved and no extra env config.
 * Best-effort: if this fails the welcome was still delivered; the only
 * downside is a possible duplicate on a later fallback attempt.
 */
export async function markWelcomeSent(uid: string): Promise<void> {
  const adminAuth = getAdminAuth();
  const user = await adminAuth.getUser(uid);
  const claims = user.customClaims || {};
  if (claims.welcomeSent === true) return;
  await adminAuth.setCustomUserClaims(uid, { ...claims, welcomeSent: true });
}
