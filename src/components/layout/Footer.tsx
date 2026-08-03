'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { subscribeNewsletter } from '@/lib/newsletter';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
      setError('Enter a valid email');
      return;
    }

    setSubmitting(true);
    try {
      await subscribeNewsletter(email.trim());
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    } catch {
      setError('Failed to subscribe. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#0b0e14] border-t border-[#1c222e] pt-10 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-8">
          {/* Brand + Tagline */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#footLogo)" opacity="0.9" />
                <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
                <circle cx="20" cy="20" r="3" fill="#C9A84C" />
                <defs>
                  <linearGradient id="footLogo" x1="4" y1="4" x2="36" y2="36">
                    <stop stopColor="#D4B96A" />
                    <stop offset="1" stopColor="#A68A3E" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-sm font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
            </div>
            <p className="text-xs text-[#8A8A8E] leading-relaxed mb-4">SECURE YOUR FUTURE WITH GOLD</p>
            <div className="flex items-center gap-3">
              {/* Facebook */}
              <a href="#" className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              {/* X/Twitter */}
              <a href="#" className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              {/* Instagram */}
              <a href="#" className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase mb-3">Quick Links</h4>
            <ul className="space-y-1.5">
              <li><Link href="/" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Home</Link></li>
              <li><Link href="/#services" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Vault Services</Link></li>
              <li><Link href="/#gold" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Assets</Link></li>
              <li><Link href="/#invest" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Invest</Link></li>
              <li><Link href="/#security" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">ROI</Link></li>
              <li><Link href="/contact" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Enquiries */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase mb-3">Enquiries</h4>
            <ul className="space-y-1.5">
              <li><Link href="/privacy" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">Terms</Link></li>
              <li><Link href="/faq" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase mb-3">Contact Us</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#C9A84C] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <a href="mailto:info@apexstorage.site" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">info@apexstorage.site</a>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#C9A84C] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <a href="tel:+13156960218" className="text-xs text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">+1 315-696-0218</a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-2">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase mb-3">Newsletter</h4>
            <p className="text-xs text-[#8A8A8E] mb-3 leading-relaxed">Stay updated with gold market insights, vault news, and exclusive offers.</p>
            <form onSubmit={handleNewsletter} className="flex">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input-aurum flex-1 text-xs rounded-r-none"
                required
                maxLength={254}
                autoComplete="email"
                disabled={submitting}
              />
              <button type="submit" className="btn-gold text-xs px-4 whitespace-nowrap rounded-l-none" disabled={submitting}>
                {submitting ? '...' : subscribed ? 'Subscribed!' : 'Subscribe'}
              </button>
            </form>
            {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
            {subscribed && <p className="text-[10px] text-green-400 mt-1">Successfully subscribed!</p>}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1c222e] pt-4 text-center">
          <p className="text-[10px] text-[#8A8A8E]">&copy; 2026 APEXSTORAGE. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
