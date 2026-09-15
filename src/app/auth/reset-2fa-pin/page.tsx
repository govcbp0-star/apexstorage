'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type ResetStatus = 'verifying' | 'form' | 'error' | 'success';

export default function ResetTwoFAPinPage() {
  const [status, setStatus] = useState<ResetStatus>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinsMatch = newPin.length > 0 && newPin === confirmPin;
  const validPin = /^\d{4,6}$/.test(newPin);
  const canSubmit = validPin && pinsMatch && !submitting;

  const getToken = () => new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setErrorMessage('This 2FA PIN reset link is invalid, expired, or has already been used.');
          setStatus('error');
        }
        return;
      }

      try {
        const response = await fetch('/api/auth/reset-2fa-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (response.ok && data.success) {
          setStatus('form');
        } else {
          setErrorMessage(data.message || 'This 2FA PIN reset link is invalid, expired, or has already been used.');
          setStatus('error');
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('We could not reach the recovery service. Please try again.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePinChange = (setter: (value: string) => void, value: string) => {
    setter(value.replace(/\D/g, '').slice(0, 6));
    setSubmitError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      if (!validPin) setSubmitError('PIN must contain 4 to 6 digits.');
      else if (!pinsMatch) setSubmitError('PINs do not match.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/auth/reset-2fa-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: getToken(), newPin }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setNewPin('');
        setConfirmPin('');
        // The PIN is changed — require a fresh primary-authentication session
        // before the new PIN can be used. Show the success panel briefly so
        // the user sees the outcome, then leave the consumed-token URL for the
        // sign-in page. (Refreshing mid-redirect revalidates the now-consumed
        // token as unavailable — expected on dev remounts only.)
        await signOut(auth).catch(() => undefined);
        setStatus('success');
        window.setTimeout(() => window.location.replace('/auth/login'), 1200);
        return;
      } else if (data.code === 'invalid-token') {
        setErrorMessage(data.message || 'This 2FA PIN reset link is no longer valid.');
        setStatus('error');
      } else {
        setSubmitError(data.message || 'We could not reset your 2FA PIN. Please try again.');
      }
    } catch {
      setSubmitError('We could not reach the recovery service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#C9A84C]/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#twoFaResetLogo)" opacity="0.9" />
              <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
              <circle cx="20" cy="20" r="3" fill="#C9A84C" />
              <defs>
                <linearGradient id="twoFaResetLogo" x1="4" y1="4" x2="36" y2="36">
                  <stop stopColor="#D4B96A" />
                  <stop offset="1" stopColor="#A68A3E" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
          </Link>
        </div>

        <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-8 shadow-2xl">
          {status === 'verifying' && (
            <StatusPanel title="VERIFYING RESET LINK" message="Validating your secure PIN reset link..." spinning />
          )}

          {status === 'error' && (
            <>
              <StatusPanel title="RESET LINK UNAVAILABLE" message={errorMessage} error />
              <div className="mt-6 text-center">
                <Link href="/auth/login" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">
                  Back to Sign In
                </Link>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <StatusPanel title="2FA PIN CHANGED" message="Your new PIN is ready. Redirecting you to Sign In..." success />
              <div className="mt-6 text-center">
                <Link href="/auth/login" className="text-xs text-[#C9A84C] hover:text-[#D4B96A] transition-colors">
                  Go to Sign In now
                </Link>
              </div>
            </>
          )}

          {status === 'form' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a4 4 0 00-4-4v4m8-8a4 4 0 018 0v4" />
                  </svg>
                </div>
              </div>
              <h1 className="text-xl font-bold tracking-[0.1em] text-[#F5F5F5] mb-2 text-center">RESET 2FA PIN</h1>
              <p className="text-xs text-[#8A8A8E] text-center mb-6 leading-relaxed">
                Choose a new 4 to 6 digit security PIN.
              </p>

              {submitError && (
                <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 text-center">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <PinField label="New 2FA PIN" value={newPin} onChange={(value) => handlePinChange(setNewPin, value)} autoFocus />
                <PinField label="Confirm New 2FA PIN" value={confirmPin} onChange={(value) => handlePinChange(setConfirmPin, value)} />
                <p className="text-[11px] text-[#5A5A5E] text-center">Use 4 to 6 numbers. Your previous PIN cannot be reused.</p>
                <button type="submit" disabled={!canSubmit} className="w-full btn-gold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                  {submitting ? 'CHANGING PIN...' : 'CHANGE PIN'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-4">
          <Link href="/" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function PinField({
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-aurum text-center tracking-[0.45em] text-lg"
        placeholder="••••••"
        minLength={4}
        maxLength={6}
        autoFocus={autoFocus}
        required
      />
    </div>
  );
}

function StatusPanel({
  title,
  message,
  spinning = false,
  error = false,
  success = false,
}: {
  title: string;
  message: string;
  spinning?: boolean;
  error?: boolean;
  success?: boolean;
}) {
  const color = error ? 'text-red-400 border-red-500/30 bg-red-500/10' : success ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-[#C9A84C] border-[#C9A84C]/30 bg-[#C9A84C]/10';
  return (
    <>
      <div className="flex justify-center mb-6">
        <div className={'w-20 h-20 rounded-full border flex items-center justify-center ' + color}>
          <svg className={'w-9 h-9 ' + (spinning ? 'animate-spin' : '')} fill="none" viewBox="0 0 24 24" aria-hidden="true">
            {success ? <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" /> : error ? <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 7v5m0 4h.01M10.3 3.8 2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0z" /> : <><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" /></>}
          </svg>
        </div>
      </div>
      <h1 className="text-xl font-bold tracking-[0.1em] text-[#F5F5F5] mb-2 text-center">{title}</h1>
      <p className="text-xs text-[#8A8A8E] text-center leading-relaxed">{message}</p>
    </>
  );
}
