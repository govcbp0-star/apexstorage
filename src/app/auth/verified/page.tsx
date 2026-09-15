'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type VerifyStatus = 'processing' | 'success' | 'error';

export default function VerifiedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<VerifyStatus>('processing');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(5);

  // In-app verification. The branded email link is generated with
  // handleCodeInApp:true, so clicking it lands here with
  // ?mode=verifyEmail&oobCode=... on ANY device/browser. We hand the code to
  // our /api/auth/verify-code route, which applies it server-side via
  // Firebase's REST API (the same operation applyActionCode performs) and
  // sends the branded welcome email in the same request — so the welcome
  // email is reliably delivered regardless of device, tab, or browser.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Email remembered by the registering tab — used as a fallback for
      // replay visits (code already consumed) or no-code visits. It is only
      // cleared once verification actually succeeds, so a transient network
      // failure doesn't destroy the fallback and the user can retry.
      const storedEmail = window.localStorage.getItem('apex_pending_verify_email');

      const params = new URLSearchParams(window.location.search);
      const oobCode = params.get('oobCode') || '';

      // Nothing to verify: no action code and no remembered pending email.
      // (The mode parameter alone doesn't carry the code, so a direct visit
      // to /auth/verified falls here too.)
      if (!oobCode && !storedEmail) {
        if (cancelled) return;
        setErrorMsg(
          'This verification link is invalid or has expired. Please request a new verification email.'
        );
        setStatus('error');
        return;
      }

      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oobCode, email: storedEmail || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          code?: string;
        };
        if (cancelled) return;

        if (res.ok && data.success) {
          window.localStorage.removeItem('apex_pending_verify_email');
          setStatus('success');
        } else {
          console.error('[Verified] Verification failed:', data.code || 'unknown', data.message || '');
          setErrorMsg(
            data.message ||
              'We could not verify your email. Please request a new verification link.'
          );
          setStatus('error');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[Verified] Verification request failed:', err);
        setErrorMsg('We could not reach the verification service. Please try again.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-redirect to login 5s after success only (never during processing/error)
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) {
      router.push('/auth/login');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, status, router]);

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
              <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#verifiedLogoGrad)" opacity="0.9" />
              <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
              <circle cx="20" cy="20" r="3" fill="#C9A84C" />
              <defs>
                <linearGradient id="verifiedLogoGrad" x1="4" y1="4" x2="36" y2="36">
                  <stop stopColor="#D4B96A" />
                  <stop offset="1" stopColor="#A68A3E" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
          </Link>
        </div>

        <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-8 shadow-2xl">
          {status === 'processing' && (
            <>
              {/* Pulsing gold ring */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#C9A84C]/10 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-[#C9A84C] animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                    </svg>
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-bold tracking-[0.1em] text-[#F5F5F5] mb-2 text-center">
                VERIFYING EMAIL
              </h2>
              <p className="text-xs text-[#8A8A8E] text-center leading-relaxed">
                Verifying your email address… this only takes a moment.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              {/* Animated success icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  {/* Outer pulse ring */}
                  <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
                  {/* Inner circle */}
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
                EMAIL VERIFIED
              </h2>
              <p className="text-xs text-[#8A8A8E] text-center mb-1 leading-relaxed">
                Your email address has been successfully verified.
              </p>
              <p className="text-xs text-[#8A8A8E] text-center mb-6 leading-relaxed">
                Your account is now active and ready to use.
              </p>

              {/* Gold divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent mb-6" />

              {/* Sign In button */}
              <Link href="/auth/login" className="w-full btn-gold flex items-center justify-center gap-2 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                SIGN IN TO YOUR ACCOUNT
              </Link>

              {/* Auto-redirect notice */}
              <p className="text-[10px] text-[#8A8A8E] text-center mt-4">
                Redirecting to sign in automatically in{' '}
                <span className="text-[#C9A84C] font-bold">{countdown}s</span>
                …
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              {/* Alert icon */}
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
                VERIFICATION FAILED
              </h2>
              <p className="text-xs text-[#8A8A8E] text-center mb-6 leading-relaxed">{errorMsg}</p>

              {/* Gold divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent mb-6" />

              <Link href="/auth/login" className="w-full btn-gold flex items-center justify-center gap-2 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                BACK TO SIGN IN
              </Link>
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
