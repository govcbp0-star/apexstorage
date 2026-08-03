'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { hashPin } from '@/lib/auth-context';

interface ProfileSettingsProps {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ProfileSettings({ open, onClose, onToast }: ProfileSettingsProps) {
  const { user, userProfile, refreshProfile } = useAuth();
  const [name, setName] = useState(userProfile?.name || '');
  const [email, setEmail] = useState(userProfile?.email || '');

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(userProfile?.twoFAEnabled || false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState(''); // for disabling 2FA
  const [showDisablePin, setShowDisablePin] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state when profile changes or modal opens
  useEffect(() => {
    if (open && userProfile) {
      setName(userProfile.name || '');
      setEmail(userProfile.email || '');
      setTwoFAEnabled(userProfile.twoFAEnabled || false);
      setShowPinSetup(false);
      setShowDisablePin(false);
      setNewPin('');
      setConfirmPin('');
      setCurrentPin('');
    }
  }, [open, userProfile]);

  const handleSave = async () => {
    if (name.trim().length < 2) { onToast('Name must be at least 2 characters', 'error'); return; }
    if (!user?.uid) { onToast('Not authenticated', 'error'); return; }

    setSaving(true);
    try {
      const updates: Record<string, string> = {
        name: name.trim(),
      };
      await update(ref(db, `users/${user.uid}`), updates);
      await refreshProfile();
      onToast('Profile updated', 'success');
      onClose();
    } catch (err) {
      console.error('[ProfileSettings] Save failed:', err);
      onToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Enable 2FA — set a new PIN */
  const handleEnable2FA = async () => {
    if (!newPin || newPin.length < 4 || newPin.length > 6) {
      onToast('PIN must be 4-6 digits', 'error');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      onToast('PIN must contain only numbers', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      onToast('PINs do not match', 'error');
      return;
    }
    if (!user?.uid) { onToast('Not authenticated', 'error'); return; }

    setSaving(true);
    try {
      const hashedPin = await hashPin(newPin);
      await update(ref(db, `users/${user.uid}`), {
        twoFAEnabled: true,
        pin2FA: hashedPin,
      });
      await refreshProfile();
      setTwoFAEnabled(true);
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      onToast('2FA enabled successfully', 'success');
    } catch (err) {
      console.error('[ProfileSettings] Enable 2FA failed:', err);
      onToast('Failed to enable 2FA', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Disable 2FA — verify current PIN first */
  const handleDisable2FA = async () => {
    if (!currentPin) {
      onToast('Enter your current PIN to disable 2FA', 'error');
      return;
    }
    if (!user?.uid || !userProfile?.pin2FA) { onToast('Not authenticated', 'error'); return; }

    setSaving(true);
    try {
      const hashedInput = await hashPin(currentPin);
      if (hashedInput !== userProfile.pin2FA) {
        onToast('Incorrect PIN', 'error');
        setSaving(false);
        return;
      }
      await update(ref(db, `users/${user.uid}`), {
        twoFAEnabled: false,
        pin2FA: null,
      });
      await refreshProfile();
      setTwoFAEnabled(false);
      setShowDisablePin(false);
      setCurrentPin('');
      onToast('2FA disabled', 'info');
    } catch (err) {
      console.error('[ProfileSettings] Disable 2FA failed:', err);
      onToast('Failed to disable 2FA', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // 2FA is available to all users

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">PROFILE SETTINGS</h3>
            <button onClick={onClose} className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#212836]">
            <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#C9A84C]/45 bg-[#1b212c] flex items-center justify-center gold-gradient shrink-0">
              <span className="text-sm font-bold text-[#1A1A1E]">
                {(name || '?').trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F5F5F5]">{userProfile?.name || 'Member'}</p>
              <p className="text-[10px] text-[#8A8A8E] tracking-wide uppercase">{userProfile?.role || 'client'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-aurum" />
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-aurum" disabled />
              <p className="text-[9px] text-[#8A8A8E] mt-0.5">Email cannot be changed</p>
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full btn-gold text-xs mt-2">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* ── 2FA Section (All Users) ── */}
          <div className="mt-5 pt-4 border-t border-[#212836]">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-[#C9A84C] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h4 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase">Two-Factor Authentication</h4>
              </div>
              <p className="text-[10px] text-[#8A8A8E] mb-3">
                Add an extra layer of security. After signing in, you&#39;ll be asked for your PIN before accessing your dashboard.
              </p>

              {!twoFAEnabled ? (
                <div>
                  {!showPinSetup ? (
                    <button
                      onClick={() => setShowPinSetup(true)}
                      className="w-full px-3 py-2.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] text-xs font-bold tracking-wider hover:bg-[#C9A84C]/20 transition-colors"
                    >
                      Enable 2FA PIN
                    </button>
                  ) : (
                    <div className="space-y-3 bg-[#1b212c] border border-[#212836] rounded-lg p-3">
                      <div>
                        <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">New PIN (4-6 digits)</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={newPin}
                          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setNewPin(v.slice(0, 6)); }}
                          className="input-aurum tracking-[0.3em] text-center text-lg"
                          placeholder="••••••"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Confirm PIN</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={confirmPin}
                          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setConfirmPin(v.slice(0, 6)); }}
                          className="input-aurum tracking-[0.3em] text-center text-lg"
                          placeholder="••••••"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleEnable2FA} disabled={saving} className="flex-1 btn-gold text-xs">
                          {saving ? 'Enabling...' : 'Enable 2FA'}
                        </button>
                        <button onClick={() => { setShowPinSetup(false); setNewPin(''); setConfirmPin(''); }} className="flex-1 btn-gold-outline text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-xs text-green-500 font-bold tracking-wider">2FA ENABLED</span>
                  </div>

                  {!showDisablePin ? (
                    <button
                      onClick={() => setShowDisablePin(true)}
                      className="w-full px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold tracking-wider hover:bg-red-500/20 transition-colors"
                    >
                      Disable 2FA
                    </button>
                  ) : (
                    <div className="space-y-3 bg-[#1b212c] border border-[#212836] rounded-lg p-3">
                      <p className="text-[10px] text-[#8A8A8E]">Enter your current PIN to disable 2FA:</p>
                      <div>
                        <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Current PIN</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={currentPin}
                          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setCurrentPin(v.slice(0, 6)); }}
                          className="input-aurum tracking-[0.3em] text-center text-lg"
                          placeholder="••••••"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleDisable2FA} disabled={saving} className="flex-1 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold tracking-wider hover:bg-red-500/20">
                          {saving ? 'Disabling...' : 'Disable 2FA'}
                        </button>
                        <button onClick={() => { setShowDisablePin(false); setCurrentPin(''); }} className="flex-1 btn-gold-outline text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
