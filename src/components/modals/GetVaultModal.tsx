'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { submitVaultRequest } from '@/lib/vault-requests';

interface GetVaultModalProps {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const locationData: Record<string, { country: string; cities: string[]; states: string[]; countries: string[] }> = {
  zurich: { country: 'Switzerland', cities: ['Zurich', 'Bern', 'Basel'], states: ['Zurich', 'Bern'], countries: ['Switzerland'] },
  singapore: { country: 'Singapore', cities: ['Singapore'], states: ['Central', 'East'], countries: ['Singapore'] },
  london: { country: 'United Kingdom', cities: ['London', 'Manchester'], states: ['England', 'Scotland'], countries: ['United Kingdom'] },
  newyork: { country: 'United States', cities: ['New York', 'Los Angeles'], states: ['New York', 'California'], countries: ['United States'] },
};

export default function GetVaultModal({ open, onClose, onToast }: GetVaultModalProps) {
  const { register, authRole, user, userProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    location: '', quantity: '', storageType: '', shippingAddress: '', city: '', state: '',
    postcode: '', country: '', notes: '', name: '', email: '', password: '',
  });
  const [cityFiltered, setCityFiltered] = useState<string[]>([]);
  const [stateFiltered, setStateFiltered] = useState<string[]>([]);
  const [countryFiltered, setCountryFiltered] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setForm({ location: '', quantity: '', storageType: '', shippingAddress: '', city: '', state: '', postcode: '', country: '', notes: '', name: '', email: '', password: '' });
    setStep(1);
    setCityFiltered([]);
    setStateFiltered([]);
    setCountryFiltered([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'location' && locationData[value]) {
      setForm((prev) => ({ ...prev, country: locationData[value].country }));
      setCityFiltered([]);
      setStateFiltered([]);
      setCountryFiltered([]);
    }
  };

  const filterCities = (val: string) => {
    if (!val || val.length < 1) { setCityFiltered([]); return; }
    const loc = form.location && locationData[form.location] ? locationData[form.location].cities : ['New York', 'London', 'Singapore', 'Zurich'];
    setCityFiltered(loc.filter(c => c.toLowerCase().includes(val.toLowerCase())));
  };

  const filterStates = (val: string) => {
    if (!val || val.length < 1) { setStateFiltered([]); return; }
    const loc = form.location && locationData[form.location] ? locationData[form.location].states : ['California', 'England', 'Ontario'];
    setStateFiltered(loc.filter(s => s.toLowerCase().includes(val.toLowerCase())));
  };

  const filterCountries = (val: string) => {
    if (!val || val.length < 1) { setCountryFiltered([]); return; }
    const loc = form.location && locationData[form.location] ? locationData[form.location].countries : ['United States', 'United Kingdom', 'Switzerland', 'Singapore'];
    setCountryFiltered(loc.filter(c => c.toLowerCase().includes(val.toLowerCase())));
  };

  const submitVaultRequestForm = () => {
    if (!form.location) { onToast('Select vault', 'error'); return; }
    const qty = parseFloat(form.quantity.replace(',', '.'));
    if (!form.quantity || isNaN(qty) || qty < 1) { onToast('Enter a valid quantity (min 1g)', 'error'); return; }
    if (!form.storageType) { onToast('Select storage type', 'error'); return; }
    if ((form.shippingAddress || '').trim().length < 5) { onToast('Enter a full street address', 'error'); return; }
    if (!(form.city || '').trim()) { onToast('Enter city', 'error'); return; }
    if (!(form.postcode || '').trim()) { onToast('Enter postcode', 'error'); return; }
    if (!(form.country || '').trim()) { onToast('Enter country', 'error'); return; }

    // If already logged in, submit directly to RTDB
    if (authRole !== 'guest' && user) {
      handleDirectSubmit(qty);
    } else {
      // Guest needs to register first
      setStep(2);
    }
  };

  const handleDirectSubmit = async (qty?: number) => {
    const quantity = qty || parseFloat(form.quantity.replace(',', '.'));
    setLoading(true);
    try {
      await submitVaultRequest({
        userName: userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Unknown',
        userId: user?.uid || '',
        userEmail: user?.email || '',
        location: form.location,
        quantity,
        storageType: form.storageType,
        shippingAddress: form.shippingAddress,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
        country: form.country,
        notes: form.notes,
      });
      setStep(3);
      onToast('Vault request submitted!', 'success');
    } catch (err: any) {
      onToast('Failed to submit vault request. Please try again.', 'error');
      console.error('Vault request error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVaultRegistration = async () => {
    const name = (form.name || '').trim();
    const email = (form.email || '').trim();
    const password = form.password || '';
    if (name.length < 2) { onToast('Enter your full name', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) { onToast('Enter a valid email', 'error'); return; }
    if (password.length < 8) { onToast('Password must be at least 8 characters', 'error'); return; }

    setLoading(true);
    try {
      if (authRole === 'guest') {
        await register(name, email, password);
      }
      // After registration, submit the vault request to RTDB
      const qty = parseFloat(form.quantity.replace(',', '.'));
      await submitVaultRequest({
        userName: name,
        userId: '', // Will be set by auth state after registration
        userEmail: email,
        location: form.location,
        quantity: qty,
        storageType: form.storageType,
        shippingAddress: form.shippingAddress,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
        country: form.country,
        notes: form.notes,
      });
      setStep(3);
      onToast('Account created & vault request submitted!', 'success');
    } catch (err: any) {
      onToast('Registration failed. Please try again.', 'error');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto custom-scrollbar">
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">GET VAULT</h3>
            <button onClick={handleClose} className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step 1: Vault details */}
          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); submitVaultRequestForm(); }} className="space-y-2">
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Vault Location</label>
                <select value={form.location} onChange={(e) => updateField('location', e.target.value)} className="input-aurum" required>
                  <option value="">Choose vault</option>
                  <option value="zurich">Zurich</option>
                  <option value="singapore">Singapore</option>
                  <option value="london">London</option>
                  <option value="newyork">New York</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Quantity (g)</label>
                  <input type="number" value={form.quantity} onChange={(e) => updateField('quantity', e.target.value)} className="input-aurum" placeholder="500" min="1" required />
                </div>
                <div>
                  <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Storage</label>
                  <select value={form.storageType} onChange={(e) => updateField('storageType', e.target.value)} className="input-aurum" required>
                    <option value="">Type</option>
                    <option value="allocated">Allocated</option>
                    <option value="pooled">Pooled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Address</label>
                <input type="text" value={form.shippingAddress} onChange={(e) => updateField('shippingAddress', e.target.value)} className="input-aurum" placeholder="Street address" required />
              </div>
              <div className="relative">
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">City</label>
                <input type="text" value={form.city} onChange={(e) => { updateField('city', e.target.value); filterCities(e.target.value); }} className="input-aurum" placeholder={form.location && locationData[form.location] ? `e.g., ${locationData[form.location].cities[0]}` : 'City'} required />
                {cityFiltered.length > 0 && form.city.length > 0 && (
                  <div className="absolute z-10 w-full bg-[#10141d] border border-[#212836] rounded-b-md mt-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {cityFiltered.map((city) => (
                      <div key={city} onClick={() => { updateField('city', city); setCityFiltered([]); }} className="px-3 py-1.5 text-xs text-[#F5F5F5] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] cursor-pointer">{city}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">State</label>
                <input type="text" value={form.state} onChange={(e) => { updateField('state', e.target.value); filterStates(e.target.value); }} className="input-aurum" placeholder={form.location && locationData[form.location] ? `e.g., ${locationData[form.location].states[0]}` : 'State'} />
                {stateFiltered.length > 0 && form.state.length > 0 && (
                  <div className="absolute z-10 w-full bg-[#10141d] border border-[#212836] rounded-b-md mt-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {stateFiltered.map((state) => (
                      <div key={state} onClick={() => { updateField('state', state); setStateFiltered([]); }} className="px-3 py-1.5 text-xs text-[#F5F5F5] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] cursor-pointer">{state}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Postcode</label>
                  <input type="text" value={form.postcode} onChange={(e) => updateField('postcode', e.target.value)} className="input-aurum" placeholder="ZIP" required />
                </div>
                <div className="relative">
                  <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Country</label>
                  <input type="text" value={form.country} onChange={(e) => { updateField('country', e.target.value); filterCountries(e.target.value); }} className="input-aurum" placeholder={form.location && locationData[form.location] ? locationData[form.location].country : 'Country'} required />
                  {countryFiltered.length > 0 && form.country.length > 0 && (
                    <div className="absolute z-10 w-full bg-[#10141d] border border-[#212836] rounded-b-md mt-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {countryFiltered.map((country) => (
                        <div key={country} onClick={() => { updateField('country', country); setCountryFiltered([]); }} className="px-3 py-1.5 text-xs text-[#F5F5F5] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] cursor-pointer">{country}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={1.5} className="input-aurum resize-none" placeholder="Optional..." />
              </div>
              <button type="submit" className="w-full btn-gold mt-2 text-xs" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          )}

          {/* Step 2: Registration (only for guests) */}
          {step === 2 && (
            <form onSubmit={(e) => { e.preventDefault(); handleVaultRegistration(); }} className="space-y-2">
              <div className="p-2 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded mb-3">
                <p className="text-[10px] text-[#C9A84C]">Vault details saved. Complete registration to submit.</p>
              </div>
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} className="input-aurum" placeholder="John Doe" required minLength={2} maxLength={120} autoComplete="name" />
              </div>
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className="input-aurum" placeholder="you@example.com" required maxLength={254} autoComplete="email" />
              </div>
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Password</label>
                <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} className="input-aurum" placeholder="Min. 8 characters" required minLength={8} maxLength={128} autoComplete="new-password" />
              </div>
              <button type="submit" className="w-full btn-gold mt-2 text-xs" disabled={loading}>
                {loading ? 'Creating...' : 'Create Account & Submit'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => setStep(1)} className="text-[10px] text-[#C9A84C] hover:underline font-medium">
                  Back
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-[#F5F5F5] mb-1 tracking-wide">REQUEST SUBMITTED</h4>
              <p className="text-[#8A8A8E] text-[10px] mb-3">
                Your vault request has been submitted successfully. We&apos;ll contact you within 24h.
              </p>
              <button onClick={handleClose} className="btn-gold w-full text-xs">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
