'use client';

import React, { useState, useEffect } from 'react';
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

interface AuthModalProps {
  open: boolean;
  mode: 'login' | 'register';
  onClose: () => void;
  onModeChange: (mode: 'login' | 'register') => void;
}

export default function AuthModal({ open, mode, onClose, onModeChange }: AuthModalProps) {
  const { login, register, googleSignIn, emailNotVerified, unverifiedEmail, resendVerification } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  // For resend flow — user re-enters password to get a new verification email
  const [resendPassword, setResendPassword] = useState('');
  const [showResendPasswordInput, setShowResendPasswordInput] = useState(false);
  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setError('');
      setVerificationSent(false);
      setResendLoading(false);
      setResendSuccess(false);
      setResendPassword('');
      setShowResendPasswordInput(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmedEmail)) {
      setError('Enter a valid email');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (mode === 'register' && trimmedName.length < 2) {
      setError('Enter your full name');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(trimmedEmail, password);
        onClose();
      } else {
        await register(trimmedName, trimmedEmail, password);
        // After registration, show verification screen instead of closing
        setVerificationSent(true);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'EMAIL_NOT_VERIFIED') {
        // User tried to login but email not verified — show verification screen
        setVerificationSent(true);
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setResetError('Enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed)) {
      setResetError('Enter a valid email');
      return;
    }

    setResetLoading(true);
    setResetError('');
    setResetMessage('');
    const result = await requestPasswordReset(trimmed);
    if (!result.code) {
      setResetMessage('Password reset email sent. Check your inbox.');
    } else if (result.code === 'auth/user-not-found') {
      setResetError('No account found with this email');
    } else if (result.code === 'auth/too-many-requests') {
      setResetError('Too many requests. Please try again later.');
    } else if (result.code === 'auth/invalid-email') {
      setResetError('Invalid email address');
    } else {
      setResetError('Failed to send reset email. Try again.');
    }
    setResetLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">
              {verificationSent ? 'VERIFY YOUR EMAIL' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </h3>
            <button onClick={onClose} className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {verificationSent ? (
            /* ── Email Verification Screen ── */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-[#F5F5F5] mb-2">Check Your Email</h4>
              <p className="text-xs text-[#8A8A8E] mb-1 leading-relaxed">
                We&apos;ve sent a verification link to
              </p>
              <p className="text-xs text-[#C9A84C] font-medium mb-4">
                {unverifiedEmail || email}
              </p>
              <p className="text-[11px] text-[#8A8A8E] mb-5 leading-relaxed">
                Please check your inbox and click the verification link to activate your account. You&apos;ll be able to sign in after verifying.
              </p>

              {resendSuccess && (
                <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-[11px] text-green-400">
                  Verification email resent successfully!
                </div>
              )}

              {showResendPasswordInput ? (
                <div className="space-y-2 mb-3">
                  <input
                    type="password"
                    value={resendPassword}
                    onChange={(e) => setResendPassword(e.target.value)}
                    className="input-aurum text-xs"
                    placeholder="Enter your password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!resendPassword || resendPassword.length < 8) return;
                      setResendLoading(true);
                      setResendSuccess(false);
                      try {
                        // Sign in briefly to trigger verification email resend
                        await login(unverifiedEmail || email, resendPassword);
                        // If login succeeds (email was verified), close the modal
                        setVerificationSent(false);
                        onClose();
                      } catch (err: unknown) {
                        if (err instanceof Error && err.message === 'EMAIL_NOT_VERIFIED') {
                          // This is expected — the login sent a new verification email and signed out
                          setResendSuccess(true);
                          setShowResendPasswordInput(false);
                          setResendPassword('');
                        } else {
                          // Wrong password or other error
                          setResendSuccess(false);
                        }
                      } finally {
                        setResendLoading(false);
                      }
                    }}
                    disabled={resendLoading || !resendPassword}
                    className="w-full btn-gold text-xs"
                  >
                    {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowResendPasswordInput(true)}
                  disabled={resendLoading}
                  className="w-full btn-gold-outline text-xs mb-3"
                >
                  Resend Verification Email
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setVerificationSent(false);
                  setShowResendPasswordInput(false);
                  setResendPassword('');
                  setResendSuccess(false);
                  onModeChange('login');
                }}
                className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : showForgotPassword ? (
            /* ── Forgot Password Screen ── */
            <div className="py-2">
              <h4 className="text-sm font-bold text-[#F5F5F5] mb-1">RESET PASSWORD</h4>
              <p className="text-[11px] text-[#8A8A8E] mb-4 leading-relaxed">
                Enter your email and we&apos;ll send you a password reset link.
              </p>

              {resetError && (
                <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400">
                  {resetError}
                </div>
              )}
              {resetMessage && (
                <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-[11px] text-green-400">
                  {resetMessage}
                </div>
              )}

              <div className="space-y-3">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="input-aurum text-xs"
                  placeholder="you@example.com"
                  autoFocus
                />
                <button
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="w-full btn-gold text-xs"
                >
                  {resetLoading ? 'Sending...' : 'SEND RESET LINK'}
                </button>
              </div>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetError('');
                    setResetMessage('');
                  }}
                  className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            /* ── Normal Login/Register Form ── */
            <>
              {error && (
                <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5">
                {mode === 'register' && (
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-aurum pl-10"
                        placeholder="John Doe"
                        required
                        minLength={2}
                        maxLength={120}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-aurum pl-10"
                      placeholder="you@example.com"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A5E] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-aurum pl-10 pr-10"
                      placeholder="••••••••"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5"
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
                {mode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setResetEmail(email);
                        setResetError('');
                        setResetMessage('');
                      }}
                      className="text-[10px] text-[#C9A84C] hover:underline tracking-wide"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
                <button type="submit" className="w-full btn-gold mt-3" disabled={loading}>
                  {loading ? 'Loading...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#1c222e]" />
                <span className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase">or</span>
                <div className="flex-1 h-px bg-[#1c222e]" />
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    await googleSignIn();
                    onClose();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
                  } finally {
                    setLoading(false);
                  }
                }}
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

              <div className="text-center text-xs text-[#8A8A8E] mt-3 tracking-wide">
                {mode === 'login' ? (
                  <p>
                    No account?{' '}
                    <button type="button" onClick={() => onModeChange('register')} className="text-[#C9A84C] hover:underline font-medium">
                      Register
                    </button>
                  </p>
                ) : (
                  <p>
                    Have account?{' '}
                    <button type="button" onClick={() => onModeChange('login')} className="text-[#C9A84C] hover:underline font-medium">
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
