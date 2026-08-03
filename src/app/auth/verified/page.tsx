'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function VerifiedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect to login after 5 seconds
  useEffect(() => {
    if (countdown <= 0) {
      router.push('/auth/login');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

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
