'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type Step = 'form' | 'sent' | 'resent';

const RESEND_COOLDOWN = 55;

export default function ChangePasswordModal({ open, onClose, email, onToast }: ChangePasswordModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('form');
      setSending(false);
      setCooldown(0);
      setError('');
    }
  }, [open]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSend = useCallback(async () => {
    if (!email) { setError('No email address available'); return; }
    setSending(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setStep('sent');
      setCooldown(RESEND_COOLDOWN);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait before trying again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }, [email]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setSending(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setStep('resent');
      setCooldown(RESEND_COOLDOWN);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait before trying again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }, [email, cooldown]);

  const handleClose = () => {
    setStep('form');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl overflow-hidden">
        <div className="p-5">

          {/* ── Header ── */}
          <div className="flex justify-between items-center mb-4">
            {step === 'form' ? (
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">Change Password</h3>
              </div>
            ) : (
              <div />
            )}
            <button onClick={handleClose} className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Step 1: Form ── */}
          {step === 'form' && (
            <>
              <p className="text-xs text-[#8A8A8E] mb-4 leading-relaxed">
                We&apos;ll send a password reset link to your registered email address.
              </p>

              <div className="mb-4">
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Email Address</label>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1b212c] border border-[#212836] rounded-lg">
                  <svg className="w-4 h-4 text-[#8A8A8E] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-[#F5F5F5] truncate">{email}</span>
                </div>
              </div>

              <div className="flex gap-2.5 mb-4 p-3 bg-[#1b212c] border border-[#212836] rounded-lg">
                <svg className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] text-[#8A8A8E] leading-relaxed">
                  Instructions: A password reset link will be sent to your registered email address. Click Send Link below to receive the password reset email and follow the instructions to create a new password.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-[#1b212c] border border-[#212836] rounded-lg text-xs text-[#8A8A8E] font-bold tracking-wider hover:bg-[#212836] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 btn-gold text-xs flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {sending ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Check Your Email ── */}
          {step === 'sent' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-[#C9A84C]/40 bg-[#C9A84C]/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#10141d]">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-bold text-[#F5F5F5] text-center mb-1">Check Your Email</h4>
              <p className="text-[11px] text-[#8A8A8E] text-center mb-4">We&apos;ve sent a password reset link to:</p>

              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1b212c] border border-[#212836] rounded-lg mb-4">
                <svg className="w-4 h-4 text-[#8A8A8E] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-[#F5F5F5] truncate">{email}</span>
              </div>

              <p className="text-[10px] text-[#8A8A8E] text-center mb-4 leading-relaxed">
                Please check your inbox (and spam/junk folder if necessary) and follow the instructions in the email to reset your password.
              </p>

              <div className="flex gap-2.5 mb-4 p-3 bg-[#1b212c] border border-[#212836] rounded-lg">
                <svg className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] text-[#8A8A8E] leading-relaxed">
                  Didn&apos;t receive the email? Check your spam folder or click Resend Link to receive a new reset link.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  onClick={handleResend}
                  disabled={sending || cooldown > 0}
                  className="flex-1 px-4 py-2.5 bg-[#1b212c] border border-[#212836] rounded-lg text-xs text-[#8A8A8E] font-bold tracking-wider hover:bg-[#212836] transition-colors disabled:opacity-50 flex flex-col items-center gap-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {sending ? 'Sending...' : 'Resend Link'}
                  </span>
                  {cooldown > 0 && <span className="text-[9px] text-[#5A5A5E]">Available in {cooldown}s</span>}
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 btn-gold text-xs"
                >
                  Done
                </button>
              </div>

              <p className="text-[9px] text-[#5A5A5E] text-center mt-3 flex items-center justify-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                For your security, this link will expire in 1 hour.
              </p>
            </>
          )}

          {/* ── Step 3: New reset link sent ── */}
          {step === 'resent' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-[#C9A84C]/40 bg-[#C9A84C]/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#10141d]">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-bold text-[#F5F5F5] text-center mb-1">New reset link sent!</h4>
              <p className="text-[11px] text-[#8A8A8E] text-center mb-1">A new password reset link has been sent to:</p>
              <p className="text-xs text-[#C9A84C] text-center font-medium mb-4">{email}</p>

              <div className="flex gap-2.5 mb-4 p-3 bg-[#1b212c] border border-[#212836] rounded-lg">
                <svg className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] text-[#8A8A8E] leading-relaxed">
                  For security reasons, you can resend the link again in {cooldown} seconds.
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full btn-gold text-xs"
              >
                CLOSE
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
