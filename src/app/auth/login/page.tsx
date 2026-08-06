'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Sends the branded APEXSTORAGE password-reset email via our backend.
 * Returns a Firebase-style error code so existing error mapping stays intact.
 */
async function requestPasswordReset(email: string): Promise<{ code?: string }> {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) return {};
    const code = data?.code as string | undefined;
    if (code === 'user-not-found') return { code: 'auth/user-not-found' };
    if (code === 'invalid-email') return { code: 'auth/invalid-email' };
    if (code === 'too-many-requests') return { code: 'auth/too-many-requests' };
    return { code: 'auth/server-error' };
  } catch {
    return { code: 'auth/network-request-failed' };
  }
}

export default function LoginPage() {
  const { login, googleSignIn, pending2FA, verify2FAPin, userProfile, logout, emailNotVerified, unverifiedEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 2FA PIN state
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState('');
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const autoVerifyTriggered = useRef(false);

  // Track if a login attempt has been made (to distinguish from initial page load)
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Email verification state
  const [showVerifyScreen, setShowVerifyScreen] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  // Redirect to dashboard when user is authenticated and NOT pending 2FA
  // This is the ONLY place we redirect — no manual router.push in handleSubmit/handleGoogleSignIn
  useEffect(() => {
    if (!pending2FA && userProfile && !loading) {
      const role = userProfile.role || localStorage.getItem('authRole') || 'client';
      router.push(role === 'admin' ? '/dashboard/admin' : '/dashboard/client');
    }
  }, [pending2FA, userProfile, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim())) { setError('Enter a valid email'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      await login(email.trim(), password);
      setLoginAttempted(true);
      // Don't redirect here! The useEffect will handle it.
      // If 2FA is enabled, React will re-render with pending2FA=true → PIN screen shows.
      // If 2FA is not enabled, React will re-render with userProfile set → useEffect redirects.
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'EMAIL_NOT_VERIFIED') {
        setShowVerifyScreen(true);
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle Google Sign-In */
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await googleSignIn();
      setLoginAttempted(true);
      // Don't redirect here! The useEffect will handle it.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /** Handle PIN digit input */
  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // only digits
    const newDigits = [...pinDigits];
    newDigits[index] = value.slice(-1); // only last digit
    setPinDigits(newDigits);
    setPinError('');

    // Auto-focus next input
    if (value && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are filled and not already verifying.
    // Pass newDigits directly (not the state) because setPinDigits is async —
    // reading pinDigits inside the synchronous handleVerifyPin would return
    // the stale value, missing the digit just typed.
    const allFilled = newDigits.every((d) => d !== '');
    if (allFilled && !loading && !autoVerifyTriggered.current) {
      autoVerifyTriggered.current = true;
      handleVerifyPin(newDigits.join(''));
    }
  };

  /** Handle PIN backspace */
  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
      const newDigits = [...pinDigits];
      newDigits[index - 1] = '';
      setPinDigits(newDigits);
    }
    if (e.key === 'Enter') {
      handleVerifyPin(pinDigits.join(''));
    }
  };

  /** Verify the PIN */
  const handleVerifyPin = async (pinOverride?: string) => {
    const pin = pinOverride ?? pinDigits.join('');
    if (pin.length < 4) {
      setPinError('Enter at least 4 digits');
      return;
    }

    setLoading(true);
    setPinError('');
    try {
      const valid = await verify2FAPin(pin);
      if (valid) {
        // pending2FA is now false, userProfile is set — the useEffect will redirect
      } else {
        setPinError('Incorrect PIN. Try again.');
        setPinDigits(['', '', '', '', '', '']);
        pinRefs.current[0]?.focus();
        autoVerifyTriggered.current = false;
      }
    } catch {
      setPinError('Verification failed. Try again.');
      autoVerifyTriggered.current = false;
    } finally {
      setLoading(false);
    }
  };

  /** Cancel 2FA and sign out */
  const handleCancel2FA = async () => {
    setPinDigits(['', '', '', '', '', '']);
    setPinError('');
    autoVerifyTriggered.current = false;
    await logout();
    setLoginAttempted(false);
  };

  /** Handle Forgot Password */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    const trimmed = resetEmail.trim();
    if (!trimmed) { setResetError('Enter your email address'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed)) { setResetError('Enter a valid email'); return; }

    setResetLoading(true);
    const result = await requestPasswordReset(trimmed);
    if (!result.code) {
      setResetMessage(`Password reset link sent to ${trimmed}. Check your inbox.`);
    } else if (result.code === 'auth/user-not-found') {
      setResetError('No account found with this email address.');
    } else if (result.code === 'auth/too-many-requests') {
      setResetError('Too many requests. Please try again later.');
    } else if (result.code === 'auth/invalid-email') {
      setResetError('Invalid email address.');
    } else {
      setResetError('Failed to send reset email. Please try again.');
    }
    setResetLoading(false);
  };

  // ── 2FA PIN Verification Screen ──
  if (pending2FA) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#pinLogoGrad)" opacity="0.9" />
                <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
                <circle cx="20" cy="20" r="3" fill="#C9A84C" />
                <defs>
                  <linearGradient id="pinLogoGrad" x1="4" y1="4" x2="36" y2="36">
                    <stop stopColor="#D4B96A" />
                    <stop offset="1" stopColor="#A68A3E" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
            </Link>
          </div>

          <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
            {/* Lock icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            <h2 className="text-lg font-bold tracking-[0.1em] text-[#F5F5F5] mb-1 text-center">TWO-FACTOR AUTH</h2>
            <p className="text-xs text-[#8A8A8E] text-center mb-5">Enter your 4-6 digit security PIN to continue</p>

            {pinError && (
              <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 text-center">{pinError}</div>
            )}

            {/* PIN Input Boxes */}
            <div className="flex justify-center gap-2 mb-5">
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { pinRefs.current[i] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className="w-10 h-12 text-center text-lg font-bold bg-[#1b212c] border border-[#212836] rounded-lg text-[#F5F5F5] tracking-widest focus:outline-none focus:border-[#C9A84C]/50 focus:ring-1 focus:ring-[#C9A84C]/30 transition-colors"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button onClick={() => handleVerifyPin()} disabled={loading} className="w-full btn-gold">
              {loading ? 'Verifying...' : 'VERIFY PIN'}
            </button>

            <div className="mt-4 text-center">
              <button
                onClick={handleCancel2FA}
                className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors"
              >
                Cancel and sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot Password Screen ──
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#fpLogoGrad)" opacity="0.9" />
                <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
                <circle cx="20" cy="20" r="3" fill="#C9A84C" />
                <defs>
                  <linearGradient id="fpLogoGrad" x1="4" y1="4" x2="36" y2="36">
                    <stop stopColor="#D4B96A" />
                    <stop offset="1" stopColor="#A68A3E" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
            </Link>
          </div>

          <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
            {resetMessage ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold tracking-[0.1em] text-[#F5F5F5] mb-2">CHECK YOUR EMAIL</h2>
                <p className="text-xs text-[#8A8A8E] mb-1 leading-relaxed">{resetMessage}</p>
                <p className="text-[11px] text-[#8A8A8E] mb-6 leading-relaxed">
                  Click the link in the email to reset your password. If you don&apos;t see it, check your spam folder.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setResetMessage(''); setResetError(''); setResetEmail(''); }}
                  className="w-full btn-gold text-xs"
                >
                  BACK TO SIGN IN
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold tracking-[0.1em] text-[#F5F5F5] mb-1 text-center">RESET PASSWORD</h2>
                <p className="text-xs text-[#8A8A8E] text-center mb-5">Enter your email to receive a password reset link</p>

                {resetError && (
                  <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">{resetError}</div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Email</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="input-aurum pl-10"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full btn-gold" disabled={resetLoading}>
                    {resetLoading ? 'Sending...' : 'SEND RESET LINK'}
                  </button>
                </form>
              </>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setResetError(''); setResetMessage(''); }}
                className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Email Verification Screen ──
  if (showVerifyScreen) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#verifyLogoGrad)" opacity="0.9" />
                <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
                <circle cx="20" cy="20" r="3" fill="#C9A84C" />
                <defs>
                  <linearGradient id="verifyLogoGrad" x1="4" y1="4" x2="36" y2="36">
                    <stop stopColor="#D4B96A" />
                    <stop offset="1" stopColor="#A68A3E" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
            </Link>
          </div>

          <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-lg font-bold tracking-[0.1em] text-[#F5F5F5] mb-2">VERIFY YOUR EMAIL</h2>
              <p className="text-xs text-[#8A8A8E] mb-1 leading-relaxed">
                We&apos;ve sent a verification link to
              </p>
              <p className="text-xs text-[#C9A84C] font-medium mb-4">
                {unverifiedEmail || email}
              </p>
              <p className="text-[11px] text-[#8A8A8E] mb-6 leading-relaxed">
                Please check your inbox and click the verification link to activate your account. You can sign in after verifying your email address.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowVerifyScreen(false);
                  setError('');
                }}
                className="w-full btn-gold text-xs mb-3"
              >
                BACK TO SIGN IN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal Login Screen ──
  return (
    <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#loginLogoGrad)" opacity="0.9" />
              <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
              <circle cx="20" cy="20" r="3" fill="#C9A84C" />
              <defs>
                <linearGradient id="loginLogoGrad" x1="4" y1="4" x2="36" y2="36">
                  <stop stopColor="#D4B96A" />
                  <stop offset="1" stopColor="#A68A3E" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
          </Link>
        </div>

        <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
          <h2 className="text-lg font-bold tracking-[0.1em] text-[#F5F5F5] mb-6 text-center">SIGN IN</h2>

          {error && (
            <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Email</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-aurum pl-10" placeholder="you@example.com" required autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Password</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input-aurum pl-10 pr-10" placeholder="••••••••" required minLength={8} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8E] hover:text-[#C9A84C]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
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
            <button type="submit" className="w-full btn-gold" disabled={loading}>
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </form>

          <div className="text-right mt-2">
            <button
              type="button"
              onClick={() => { setShowForgotPassword(true); setResetEmail(email); setResetError(''); setResetMessage(''); }}
              className="text-[10px] text-[#C9A84C] hover:underline tracking-wide"
            >
              Forgot Password?
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1c222e]" />
            <span className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase">or</span>
            <div className="flex-1 h-px bg-[#1c222e]" />
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[#1b212c] border border-[#1c222e] rounded-lg text-[#F5F5F5] text-xs font-bold tracking-wide uppercase hover:border-[#C9A84C]/30 hover:bg-[#212836] transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-4 text-center">
            <p className="text-xs text-[#8A8A8E]">
              No account?{' '}
              <Link href="/auth/register" className="text-[#C9A84C] hover:underline font-medium">Register</Link>
            </p>
          </div>

        </div>

        <div className="text-center mt-4">
          <Link href="/" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
