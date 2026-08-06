import { render } from '@react-email/render';
import * as React from 'react';
import { getAdminAuth, isAdminConfigured } from '@/lib/firebase-admin';
import { getResend, EMAIL_FROM, REPLY_TO, SUPPORT_EMAIL, APP_URL } from '@/lib/resend';
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

  if (message.includes('not configured')) {
    return { success: false, code: 'not-configured', message: 'Email service is not configured.' };
  }
  if (code === 'auth/user-not-found') {
    return { success: false, code: 'user-not-found', message: 'No account found with this email.' };
  }
  if (code === 'auth/invalid-email') {
    return { success: false, code: 'invalid-email', message: 'Invalid email address.' };
  }
  if (code === 'auth/too-many-requests') {
    return { success: false, code: 'too-many-requests', message: 'Too many requests. Please try again later.' };
  }
  return { success: false, code: 'server-error', message: 'Failed to send email. Please try again.' };
}

async function deliver(to: string, subject: string, html: string): Promise<AuthEmailResult> {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    replyTo: REPLY_TO,
    to,
    subject,
    html,
  });
  if (error) {
    console.error('[AuthEmail] Resend delivery failed:', error);
    return { success: false, code: 'server-error', message: 'Failed to send email. Please try again.' };
  }
  return { success: true, message: 'Email sent successfully.' };
}

function validateRequest(email: string): AuthEmailResult | null {
  if (!email || !EMAIL_RE.test(email)) {
    return { success: false, code: 'invalid-email', message: 'Invalid email address.' };
  }
  if (!isAdminConfigured()) {
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
    const link = await adminAuth.generateEmailVerificationLink(email, {
      url: `${APP_URL}/auth/verified`,
      handleCodeInApp: false,
    });
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
    const link = await adminAuth.generatePasswordResetLink(email, {
      url: `${APP_URL}/auth/login`,
      handleCodeInApp: false,
    });
    const html = await render(
      React.createElement(ResetPasswordEmail, { resetUrl: link, supportEmail: SUPPORT_EMAIL })
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
    const html = await render(
      React.createElement(WelcomeEmail, {
        name,
        dashboardUrl: `${APP_URL}/dashboard/client`,
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
