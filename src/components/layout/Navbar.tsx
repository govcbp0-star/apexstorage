'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AuthModal from '@/components/modals/AuthModal';

export default function Navbar() {
  const { authRole, userProfile, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const activeNav = pathname === '/contact' ? 'contact' : pathname === '/' ? activeSection : '';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const sections = ['home', 'services', 'gold', 'invest', 'security'];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle hash-based scrolling after navigating from another page
  useEffect(() => {
    if (pathname === '/' && window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        // Slight delay to let the page render first
        setTimeout(() => {
          const top = el.getBoundingClientRect().top + window.pageYOffset - 64;
          window.scrollTo({ top, behavior: 'smooth' });
          // Clear the hash so it doesn't re-scroll on refresh
          history.replaceState(null, '', '/');
        }, 300);
      }
    }
  }, [pathname]);

  const scrollTo = (id: string) => {
    if (pathname !== '/') {
      // Not on home page — navigate there first, then scroll after render
      router.push(`/#${id}`);
      setMobileMenuOpen(false);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 64;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  // Keep nav auth actions local so they work on every page using Navbar.
  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { id: 'home', label: 'HOME', onClick: () => scrollTo('home') },
    { id: 'services', label: 'VAULT SERVICES', onClick: () => scrollTo('services') },
    { id: 'gold', label: 'ASSETS', onClick: () => scrollTo('gold') },
    { id: 'invest', label: 'INVEST', onClick: () => scrollTo('invest') },
    { id: 'security', label: 'ROI', onClick: () => scrollTo('security') },
  ];

  return (
    <>
      <AuthModal
        open={authModalOpen}
        mode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onModeChange={setAuthMode}
      />
      <nav
        className={`fixed w-full z-50 bg-[#0b0e14]/95 backdrop-blur-lg border-b border-[#1c222e] transition-all duration-300 ${
          scrolled ? 'shadow-2xl shadow-black/30' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#logoGrad)" opacity="0.9" />
                <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
                <circle cx="20" cy="20" r="3" fill="#C9A84C" />
                <defs>
                  <linearGradient id="logoGrad" x1="4" y1="4" x2="36" y2="36">
                    <stop stopColor="#D4B96A" />
                    <stop offset="1" stopColor="#A68A3E" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
            </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {authRole === 'guest' && (
              <div className="flex items-center gap-0">
                {navLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={link.onClick}
                    className={`nav-link px-3 py-2 font-medium text-xs tracking-wide cursor-pointer bg-transparent border-none ${
                      activeNav === link.id
                        ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                        : 'text-[#F5F5F5] hover:text-[#C9A84C]'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
                <Link
                  href="/contact"
                  className={`nav-link px-3 py-2 font-medium text-xs tracking-wide cursor-pointer bg-transparent border-none ${
                    activeNav === 'contact'
                      ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                      : 'text-[#F5F5F5] hover:text-[#C9A84C]'
                  }`}
                >
                  CONTACT
                </Link>
                <div className="w-px h-5 bg-[#1b212c] mx-2" />
                <button onClick={() => openAuthModal('login')} className="btn-ghost">
                  SIGN IN
                </button>
                <button onClick={() => openAuthModal('register')} className="ml-2 btn-gold-outline text-xs">
                  GET STARTED
                </button>
              </div>
            )}
            {authRole === 'client' && (
              <div className="flex items-center gap-3">
                <Link href="/dashboard/client" className="btn-gold-outline text-xs">
                  DASHBOARD
                </Link>
                <span className="text-[#8A8A8E] text-xs tracking-wide">
                  Welcome, <span className="text-[#C9A84C]">{userProfile?.name || 'Client'}</span>
                </span>
                <button onClick={handleLogout} className="btn-ghost">
                  SIGN OUT
                </button>
              </div>
            )}
            {authRole === 'admin' && (
              <div className="flex items-center gap-3">
                <Link href="/dashboard/admin" className="btn-gold-outline text-xs">
                  ADMIN PANEL
                </Link>
                <span className="text-[#8A8A8E] text-xs tracking-wide flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5 text-[#C9A84C]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span className="text-[#C9A84C]">{userProfile?.name || 'Admin'}</span>
                </span>
                <button onClick={handleLogout} className="btn-ghost">
                  SIGN OUT
                </button>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-[#F5F5F5] hover:text-[#C9A84C] transition-colors p-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#1c222e] bg-[#0b0e14]/98 backdrop-blur-xl">
          <div className="px-4 pt-3 pb-4 space-y-1">
            {authRole === 'guest' && (
              <div className="space-y-0">
                {navLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={link.onClick}
                    className={`block w-full text-left py-2 font-medium text-xs tracking-wide cursor-pointer bg-transparent border-none ${
                      activeNav === link.id ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-[#F5F5F5] hover:text-[#C9A84C]'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
                <Link
                  href="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block w-full text-left py-2 font-medium text-xs tracking-wide cursor-pointer bg-transparent border-none ${
                    activeNav === 'contact'
                      ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                      : 'text-[#F5F5F5] hover:text-[#C9A84C]'
                  }`}
                >
                  CONTACT
                </Link>
                <div className="pt-3 flex gap-2">
                  <button onClick={() => openAuthModal('login')} className="flex-1 btn-ghost text-center border border-[#1c222e] rounded-sm text-xs">
                    SIGN IN
                  </button>
                  <button onClick={() => openAuthModal('register')} className="flex-1 btn-gold-outline text-center text-xs">
                    GET STARTED
                  </button>
                </div>
              </div>
            )}
            {authRole === 'client' && (
              <div className="space-y-2">
                <Link href="/dashboard/client" className="block w-full text-center py-2 text-[#C9A84C] font-medium text-xs tracking-wide border border-[#1c222e] rounded-sm">
                  DASHBOARD
                </Link>
                <button onClick={handleLogout} className="w-full btn-ghost text-center border border-[#1c222e] rounded-sm py-2 text-xs">
                  SIGN OUT
                </button>
              </div>
            )}
            {authRole === 'admin' && (
              <div className="space-y-2">
                <Link href="/dashboard/admin" className="block w-full text-center py-2 text-[#C9A84C] font-medium text-xs tracking-wide border border-[#1c222e] rounded-sm">
                  ADMIN PANEL
                </Link>
                <button onClick={handleLogout} className="w-full btn-ghost text-center border border-[#1c222e] rounded-sm py-2 text-xs">
                  SIGN OUT
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </nav>
    </>
  );
}
