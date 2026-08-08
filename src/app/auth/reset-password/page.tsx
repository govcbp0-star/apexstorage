'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type ResetStatus = 'verifying' | 'form' | 'error' | 'success';

/** App-wide password policy (matches register/login/GetVaultModal validation). */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<ResetStatus>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const minOk = password.length >= PASSWORD_MIN;
  const maxOk = password.length <= PASSWORD_MAX;
  const matchOk = password.length > 0 && password === confirm;
  const formValid = minOk && maxOk && matchOk;

  // On load: read the oobCode from the URL (the branded email link is generated
  // with handleCodeInApp:true, so clicking it lands here with
  // ?mode=resetPassword&oobCode=...) and validate it server-side through
  // Firebase's REST API. No code is consumed by validation — only submission.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oobCode = params.get('oobCode') || '';

      // The oobCode itself is what matters — the server route validates its
      // type via Firebase's accounts:resetPassword (a verifyEmail code or a
      // garbage value is rejected there with a friendly message). We do NOT
      // require mode === 'resetPassword' here: Firebase's hosted in-app
      // redirect normally appends mode, but the page must keep working even
      // if a real link omits or varies it.
      if (!oobCode) {
        if (cancelled) return;
        setErrorMsg(
          'This password reset link is invalid or has expired. Please request a new password reset link.'
        );
        setStatus('error');
        return;
      }

      try {
        const res = await fetch('/api/auth/reset-password-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oobCode }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          code?: string;
          message?: string;
        };
        if (cancelled) return;

        if (res.ok && data.success) {
          setStatus('form');
        } else {
          setErrorMsg(
            data.message ||
              'This password reset link is invalid or has expired. Please request a new password reset link.'
          );
          setStatus('error');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[ResetPassword] Code validation failed:', err);
        setErrorMsg('We could not reach the reset service. Please try again.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // prevent duplicate submissions
    setSubmitError('');

    if (!password) {
      setSubmitError('Enter a new password.');
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setSubmitError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password.length > PASSWORD_MAX) {
      setSubmitError(`Password must be at most ${PASSWORD_MAX} characters.`);
      return;
    }
    if (!confirm) {
      setSubmitError('Confirm your new password.');
      return;
    }
    if (password !== confirm) {
      setSubmitError('Passwords do not match.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const oobCode = params.get('oobCode') || '';

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode, newPassword: password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        code?: string;
        message?: string;
      };

      if (res.ok && data.success) {
        setPassword('');
        setConfirm('');
        setStatus('success');
      } else if (data.code === 'invalid-code') {
        // The code was consumed elsewhere or expired between validation and
        // submission — the link is no longer usable.
        setErrorMsg(
          data.message ||
            'This password reset link is invalid or has expired. Please request a new password reset link.'
        );
        setStatus('error');
      } else {
        setSubmitError(data.message || 'We could not reset your password. Please try again.');
      }
    } catch (err) {
      console.error('[ResetPassword] Reset request failed:', err);
      setSubmitError('We could not reach the reset service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#C9A84C]/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#rpLogoGrad)" opacity="0.9" />
              <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
              <circle cx="20" cy="20" r="3" fill="#C9A84C" />
              <defs>
                <linearGradient id="rpLogoGrad" x1="4" y1="4" x2="36" y2="36">
                  <stop stopColor="#D4B96A" />
                  <stop offset="1" stopColor="#A68A3E" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
          </Link>
        </div>

        <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-8 shadow-2xl">
          {/* ── Verifying link ── */}
          {status === 'verifying' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#C9A84C]/10 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#C9A84C] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                    </svg>
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-bold tracking-[0.1em] text-[#F5F5F5] mb-2 text-center">
                VERIFYING RESET LINK
              </h2>
              <p className="text-xs text-[#8A8A8E] text-center leading-relaxed">
                Validating your password reset link… this only takes a moment.
              </p>
            </>
          )}

          {/* ── Invalid / expired link ── */}
          {status === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="relative w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-bold tracking-[0.1em] text-[#F5F5F5] mb-2 text-center">
                RESET LINK INVALID
              </h2>
              <p className="text-xs text-[#8A8A8E] text-center mb-6 leading-relaxed">{errorMsg}</p>

              <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent mb-6" />

              <Link
                href="/auth/login"
                className="w-full btn-gold flex items-center justify-center gap-2 text-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                REQUEST NEW RESET LINK
              </Link>
              <p className="text-[10px] text-[#8A8A8E] text-center mt-4 leading-relaxed">
                You will be able to request a new link from the sign-in page.
              </p>
            </>
          )}

          {/* ── Success ── */}
          {status === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-bold tracking-[0.1em] text-[#F5F5F5] mb-2 text-center">
                PASSWORD UPDATED
              </h2>
              <p className="text-xs text-[#8A8A8E] text-center mb-1 leading-relaxed">
                Your APEXSTORAGE password has been successfully updated.
              </p>
              <p className="text-xs text-[#8A8A8E] text-center mb-6 leading-relaxed">
                You can now sign in using your new password.
              </p>

              <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent mb-6" />

              <Link
                href="/auth/login"
                className="w-full btn-gold flex items-center justify-center gap-2 text-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                CONTINUE TO SIGN IN
              </Link>
            </>
          )}

          {/* ── New password form ── */}
          {status === 'form' && (
            <>
              {/* Lock icon */}
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                </div>
              </div>

              <h2 className="text-xl font-bold tracking-[0.1em] text-[#F5F5F5] mb-1 text-center">
                CREATE NEW PASSWORD
              </h2>
              <p className="text-xs text-[#8A8A8E] text-center mb-6 leading-relaxed">
                Set a new secure password for your APEXSTORAGE account.
              </p>

              {submitError && (
                <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* New Password */}
                <div>
                  <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-aurum pl-10 pr-10"
                      placeholder="••••••••"
                      required
                      minLength={PASSWORD_MIN}
                      maxLength={PASSWORD_MAX}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPassword ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        ) : (
                          <>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="input-aurum pl-10 pr-10"
                      placeholder="••••••••"
                      required
                      minLength={PASSWORD_MIN}
                      maxLength={PASSWORD_MAX}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showConfirm ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        ) : (
                          <>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Requirements checklist — updates live as the user types */}
                <ul className="space-y-1.5">
                  <Requirement ok={minOk} label={`At least ${PASSWORD_MIN} characters`} />
                  <Requirement ok={maxOk} label={`No more than ${PASSWORD_MAX} characters`} />
                  <Requirement ok={matchOk} label="Passwords match" />
                </ul>

                <button
                  type="submit"
                  disabled={!formValid || submitting}
                  className="w-full btn-gold mt-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {submitting ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                      </svg>
                      RESETTING...
                    </>
                  ) : (
                    'RESET PASSWORD'
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link href="/auth/login" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Back to home */}
        <div className="text-center mt-4">
          <Link href="/" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Small inline requirement row that ticks gold/green once satisfied. */
function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[11px]">
      <span
        className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
          ok
            ? 'bg-green-500/15 border-green-500/40 text-green-400'
            : 'border-[#212836] text-transparent'
        }`}
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className={ok ? 'text-[#B0B0B4]' : 'text-[#5A5A5E]'}>{label}</span>
    </li>
  );
}
