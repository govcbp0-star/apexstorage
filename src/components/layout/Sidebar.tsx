'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface SidebarProps {
  type: 'client' | 'admin';
  activeNav: string;
  onNavChange: (nav: string) => void;
  sidebarOpen: boolean;
  onClose: () => void;
  onOpenProfile?: () => void;
  goldSpotPrice?: number;
}

const clientNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'holdings', label: 'Holdings', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'orders', label: 'Orders', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  { id: 'shipments', label: 'Shipments', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
  { id: 'transactions', label: 'Transactions', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'vault', label: 'Vault', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

const adminNavItems = [
  { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'assets', label: 'Assets', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'approvals', label: 'Approvals', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'transactions', label: 'Transactions', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'messages', label: 'Messages', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'vaults', label: 'Vaults', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'orders', label: 'Orders', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  { id: 'newsletter', label: 'Newsletter', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
];

export default function Sidebar({
  type,
  activeNav,
  onNavChange,
  sidebarOpen,
  onClose,
  onOpenProfile,
  goldSpotPrice,
}: SidebarProps) {
  const { userProfile, logout } = useAuth();
  const navItems = type === 'client' ? clientNavItems : adminNavItems;
  const initials = (userProfile?.name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const handleNavClick = (id: string) => {
    // All nav items now switch sections via onNavChange
    // Buy Gold / Shipment / Get Vault are opened from buttons within sections
    onNavChange(id);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[39] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-[#10141d] border-r border-[#1c222e] z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#212836] lg:hidden">
          <span className="text-[9px] font-bold text-[#C9A84C] tracking-[0.2em] uppercase">
            {type === 'client' ? 'Client' : 'Admin'} Portal
          </span>
          <button onClick={onClose} className="text-[#8A8A8E] hover:text-[#F5F5F5] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="h-0.5 gold-gradient w-full hidden lg:block" />

        {/* User info */}
        <div className="px-4 py-3 border-b border-[#212836] flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-[#C9A84C]/45 bg-[#1b212c] shrink-0 flex items-center justify-center gold-gradient">
            <span className="text-[11px] font-bold text-[#1A1A1E]">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#F5F5F5] truncate">{userProfile?.name || 'Member'}</p>
            {type === 'admin' && <p className="text-[9px] text-[#8A8A8E] tracking-wide">Admin Portal</p>}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar">
          <p className="text-[9px] font-bold text-[#8A8A8E] tracking-[0.2em] uppercase px-3 mb-2">Navigation</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-all ${
                activeNav === item.id
                  ? 'bg-[rgba(201,168,76,0.1)] text-[#C9A84C] border border-[#C9A84C]/20'
                  : 'text-[#8A8A8E] hover:bg-[#1b212c] hover:text-[#F5F5F5] border border-transparent'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}

          <div className="pt-3 mt-2 border-t border-[#212836]">
            <p className="text-[9px] font-bold text-[#8A8A8E] tracking-[0.2em] uppercase px-3 mb-2">Account</p>
            {onOpenProfile && (
              <button
                onClick={() => { onOpenProfile(); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-[#8A8A8E] hover:bg-[#1b212c] hover:text-[#F5F5F5] transition-all"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Profile Settings
              </button>
            )}
            <Link
              href="/"
              onClick={() => { logout(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-[#8A8A8E] hover:bg-red-500/10 hover:text-red-400 transition-all"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </Link>
          </div>
        </nav>

        {/* Spot price */}
        {goldSpotPrice !== undefined && (
          <div className="px-4 py-3 border-t border-[#212836] flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
            <div>
              <p className="text-[9px] text-[#8A8A8E] uppercase tracking-wider">Live Spot</p>
              <p className="text-xs font-bold text-[#C9A84C] tabular-nums">
                ${goldSpotPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /oz
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
