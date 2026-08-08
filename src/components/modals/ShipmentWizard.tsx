'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { submitShipment } from '@/lib/shipments-service';
import { submitTransaction } from '@/lib/transactions-service';
import { CryptoCheckoutModal } from './CryptoCheckoutModal';

interface Asset {
  id: string;
  ref: string;
  type: string;
  weight: number;
  status: string;
  vaultLocation?: string;
}

interface ShipmentWizardProps {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  assets: Asset[];
  goldSpotPrice: number;
}

const ASSET_TYPES = [
  { value: 'bar', label: 'Gold Bar' },
  { value: 'coin', label: 'Gold Coin' },
  { value: 'jewellery', label: 'Jewellery' },
] as const;

// ── Vault location metadata (city + country) ─────────────────────────
const VAULT_LOCATION_META: Record<string, { label: string; country: string }> = {
  zurich: { label: 'Zurich', country: 'Switzerland' },
  singapore: { label: 'Singapore', country: 'Singapore' },
  london: { label: 'London', country: 'United Kingdom' },
  newyork: { label: 'New York', country: 'United States' },
};

function locKey(loc: string): string {
  const l = (loc || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (l.includes('zurich')) return 'zurich';
  if (l.includes('singapore')) return 'singapore';
  if (l.includes('london')) return 'london';
  if (l.includes('newyork')) return 'newyork';
  return l;
}

export default function ShipmentWizard({ open, onClose, onToast, assets, goldSpotPrice }: ShipmentWizardProps) {
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [form, setForm] = useState({
    assetType: '', assetId: '', shippingAmount: '', partialGrams: '', deliveryName: '', deliveryPhone: '',
    deliveryAddress: '', deliveryCity: '', deliveryPostcode: '', deliveryCountry: '', agreedTerms: false,
  });

  const lockedGoldPriceRef = useRef<number | null>(null);
  const prevInputKeyRef = useRef<string>('');

  const handleClose = () => {
    setStep(1);
    setLoading(false);
    lockedGoldPriceRef.current = null;
    setForm({ assetType: '', assetId: '', shippingAmount: '', partialGrams: '', deliveryName: '', deliveryPhone: '', deliveryAddress: '', deliveryCity: '', deliveryPostcode: '', deliveryCountry: '', agreedTerms: false });
    onClose();
  };

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validatePhone = (s: string) => {
    const d = (s || '').replace(/\D/g, '');
    return d.length >= 7 && d.length <= 15;
  };

  // Active assets (always use full list so filtering works)
  const activeAssets = useMemo(() => assets.filter((a) => a.status === 'active'), [assets]);

  // Always show all asset types — if user has no assets of a type, the second dropdown will explain
  const availableTypes = ASSET_TYPES;

  // Assets filtered by the selected type
  const filteredAssets = useMemo(() => {
    if (!form.assetType) return [];
    return activeAssets.filter((a) => a.type === form.assetType);
  }, [activeAssets, form.assetType]);

  // Vault-location groups derived from the assets of the selected type.
  // Each group aggregates every active asset of that type stored at that
  // location — the "Select Asset" drop-down shows one option per location
  // ("New York – Total Assets: 3") instead of one option per asset.
  const vaultGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; country: string; assets: Asset[]; totalWeight: number }>();
    filteredAssets.forEach((a) => {
      const k = locKey(a.vaultLocation || '');
      if (!k) return;
      const meta = VAULT_LOCATION_META[k];
      const label = meta?.label || k;
      const country = meta?.country || '—';
      if (!map.has(k)) map.set(k, { key: k, label, country, assets: [], totalWeight: 0 });
      const grp = map.get(k)!;
      grp.assets.push(a);
      grp.totalWeight += a.weight;
    });
    return Array.from(map.values());
  }, [filteredAssets]);

  // The selected vault group (keyed by form.assetId which now holds the vault key)
  const selectedGroup = vaultGroups.find((g) => g.key === form.assetId) || null;

  const handleNext = async () => {
    if (step === 1) {
      if (!form.assetType) { onToast('Select an asset type', 'error'); return; }
      if (!form.assetId) { onToast('Select a vault location', 'error'); return; }
      if (!selectedGroup) { onToast('Select a vault location', 'error'); return; }
      if (selectedGroup.totalWeight < 1000) {
        onToast('Vault location must have at least 1,000 grams stored to ship', 'error');
        return;
      }
    }
    if (step === 2) {
      if (!form.shippingAmount) { onToast('Select a shipping preference', 'error'); return; }
      const totalWeight = selectedGroup?.totalWeight || 0;
      if (form.shippingAmount === 'ship_partial') {
        if (!form.partialGrams || parseFloat(form.partialGrams) <= 0) { onToast('Enter amount in grams', 'error'); return; }
        const gramAmount = parseFloat(form.partialGrams);
        const minGrams = Math.ceil(totalWeight * 0.25);
        if (gramAmount < minGrams) { onToast(`Minimum shipping weight is 25% of the vault location's total (${minGrams}g)`, 'error'); return; }
        if (gramAmount > totalWeight) {
          onToast(`Cannot ship more than the vault location's total weight of ${totalWeight}g`, 'error');
          return;
        }
      } else if (form.shippingAmount === 'ship_full') {
        if (totalWeight < 1000) { onToast('Vault location must have at least 1,000 grams stored to ship', 'error'); return; }
      }
    }
    if (step === 3) {
      const name = (form.deliveryName || '').trim();
      const phone = form.deliveryPhone || '';
      const address = (form.deliveryAddress || '').trim();
      const city = (form.deliveryCity || '').trim();
      const postcode = (form.deliveryPostcode || '').trim();
      const country = (form.deliveryCountry || '').trim();
      if (name.length < 2) { onToast('Enter recipient name', 'error'); return; }
      if (!validatePhone(phone)) { onToast('Enter a valid phone (7-15 digits)', 'error'); return; }
      if (address.length < 5) { onToast('Enter a full delivery address', 'error'); return; }
      if (!city) { onToast('Enter city', 'error'); return; }
      if (!postcode) { onToast('Enter ZIP/postcode', 'error'); return; }
      if (!country) { onToast('Enter country', 'error'); return; }
    }
    if (step === 4 && !form.agreedTerms) { onToast('Agree to terms & fees', 'error'); return; }

    if (step < 5) {
      setStep(step + 1);
    } else {
      // Prepare shipment for payment
      setLoading(true);
      try {
        const totalWeight = selectedGroup?.totalWeight || 0;
        const weight = form.shippingAmount === 'ship_full'
          ? totalWeight
          : (parseFloat(form.partialGrams) || 0);

        // Combined ref of all assets at the selected vault location
        const assetRef = selectedGroup?.assets.map((a) => a.ref).filter(Boolean).join(', ') || selectedGroup?.label || '';
        const assetId = selectedGroup?.assets.map((a) => a.id).filter(Boolean).join(',') || form.assetId;

        // Calculate shipment fee: 0.25% of the asset's value based on locked gold price
        // Formula: (weight_grams / 31.1035 oz_per_gram) * goldSpotPrice * 0.25%
        const assetValueInUSD = (weight / 31.1035) * effectiveGoldPrice;
        const shipmentFee = Math.ceil(assetValueInUSD * 0.0025); // 0.25% fee, rounded up to nearest whole number

        const shipmentId = `${user?.uid || 'user'}_shipment_${Date.now()}`;

        const shipmentData = {
          userName: userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Unknown',
          userId: user?.uid || '',
          userEmail: user?.email || '',
          assetRef,
          assetId,
          shippingAmount: form.shippingAmount,
          partialGrams: form.shippingAmount === 'ship_partial' ? parseFloat(form.partialGrams) || 0 : 0,
          deliveryName: form.deliveryName,
          deliveryPhone: form.deliveryPhone,
          deliveryAddress: form.deliveryAddress,
          deliveryCity: form.deliveryCity,
          deliveryPostcode: form.deliveryPostcode,
          deliveryCountry: form.deliveryCountry,
          weight,
          shipmentFee,
          shipmentId,
          paymentMethod: 'crypto',
          paymentStatus: 'pending',
        };

        // 1. Create shipment record with pending payment status
        const savedShipmentId = await submitShipment(shipmentData);

        const description = `Shipment: ${shipmentData.deliveryCity}, ${shipmentData.deliveryCountry}`;

        // 2. Create transaction record mapped to order
        await submitTransaction({
          userId: user?.uid || '',
          userEmail: user?.email || '',
          userName: shipmentData.userName,
          type: 'shipment',
          description,
          amount: shipmentFee || 50,
          currency: 'usd',
          cryptoCurrency: '',
          cryptoAmount: 0,
          paymentId: '',
          paymentStatus: 'pending',
          shipmentId: savedShipmentId,
          metadata: {
            orderId: savedShipmentId,
          },
        });

        // 3. Open Custom Checkout
        setCheckoutData({
          amount: shipmentFee || 50,
          description,
          orderId: savedShipmentId,
          initialEmail: user?.email || '',
        });
        setShowCheckout(true);
      } catch (err: any) {
        onToast('Failed to create shipment. Please try again.', 'error');
        console.error('Shipment creation error:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!open) return null;

  // Find the selected asset type label and vault group for review
  const selectedTypeLabel = ASSET_TYPES.find(t => t.value === form.assetType)?.label || form.assetType;

  // Calculate weight and shipment fee for display
  const shipmentWeight = form.shippingAmount === 'ship_full'
    ? (selectedGroup?.totalWeight || 0)
    : (parseFloat(form.partialGrams) || 0);

  // Lock the gold price when inputs change; recalculate only on input changes
  const inputKey = `${form.assetId}|${form.shippingAmount}|${form.partialGrams}`;
  if (inputKey !== prevInputKeyRef.current) {
    prevInputKeyRef.current = inputKey;
    lockedGoldPriceRef.current = goldSpotPrice;
  }
  const effectiveGoldPrice = lockedGoldPriceRef.current ?? goldSpotPrice;

  const shipmentAssetValue = (shipmentWeight / 31.1035) * effectiveGoldPrice;
  const calculatedShipmentFee = Math.ceil(shipmentAssetValue * 0.0025);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto custom-scrollbar">
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">SHIPMENT</h3>
            <button onClick={handleClose} className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-[#C9A84C]' : 'bg-[#212836]'}`} />
            ))}
          </div>

          <div className="space-y-3">
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-[#8A8A8E] font-bold mb-1">SELECT ASSET</p>

                  {/* Asset Type selector */}
                  <div>
                    <label className="text-[10px] text-[#8A8A8E] uppercase tracking-wider mb-1 block">Asset Type</label>
                    <div className="relative">
                      <select
                        value={form.assetType}
                        onChange={(e) => {
                          updateField('assetType', e.target.value);
                          updateField('assetId', ''); // reset vault location when type changes
                        }}
                        className="input-aurum w-full appearance-none pr-8"
                        required
                      >
                        <option value="">Choose type</option>
                        {availableTypes.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8A8A8E]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {/* Icon display based on selected type */}
                    {form.assetType && (
                      <div className="mt-2 flex items-center gap-2 p-2 bg-[#1b212c] border border-[#212836] rounded">
                        {form.assetType === 'bar' && (
                          <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="7" width="18" height="10" rx="1" />
                            <path d="M5 7L6 4h12l1 3" strokeWidth="1" stroke="currentColor" fill="none" />
                          </svg>
                        )}
                        {form.assetType === 'coin' && (
                          <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="9" fill="currentColor" />
                            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
                            <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                            <path d="M10 12h4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                          </svg>
                        )}
                        {form.assetType === 'jewellery' && (
                          <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z" />
                            <rect x="11" y="16" width="2" height="4" />
                            <path d="M9 20h6" strokeWidth="1" stroke="currentColor" fill="none" />
                          </svg>
                        )}
                        <span className="text-xs text-[#F5F5F5]">{ASSET_TYPES.find(t => t.value === form.assetType)?.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Vault location selector — only shown after type is selected.
                       Lists one option per vault location (city) aggregating all
                       active assets of the chosen type stored there. */}
                  {form.assetType && (
                    <div>
                      <label className="text-[10px] text-[#8A8A8E] uppercase tracking-wider mb-1 block">Select Vault Location</label>
                      {vaultGroups.length > 0 ? (
                        <select
                          value={form.assetId}
                          onChange={(e) => updateField('assetId', e.target.value)}
                          className="input-aurum"
                          required
                        >
                          <option value="">Choose vault location</option>
                          {vaultGroups.map((g) => (
                            <option key={g.key} value={g.key}>{g.label} – Total Assets: {g.totalWeight}g</option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3 border border-[#212836] rounded bg-[#1b212c]">
                          <p className="text-[10px] text-[#8A8A8E]">No active assets of this type found.</p>
                          <p className="text-[9px] text-[#C9A84C] mt-1">Purchase gold first, or wait for admin to approve your order.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick info about the selected vault location */}
                  {form.assetId && selectedGroup && (
                    <div className="p-3 bg-[#1b212c] border border-[#212836] rounded space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider">Selected</span>
                        <span className="text-[10px] text-[#C9A84C] font-bold uppercase">{selectedTypeLabel}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#F5F5F5]">Location</span>
                        <span className="text-[11px] text-[#F5F5F5]">{selectedGroup.label}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#F5F5F5]">Total Weight</span>
                        <span className="text-[11px] text-[#F5F5F5]">{selectedGroup.totalWeight}g</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2">
                  <p className="text-xs text-[#8A8A8E] font-bold mb-1">PREFERENCE</p>
                  <label className="flex items-center gap-2 p-2.5 border border-[#212836] rounded cursor-pointer hover:border-[#C9A84C]/30 transition-colors">
                    <input type="radio" name="shippingAmount" value="ship_full" checked={form.shippingAmount === 'ship_full'} onChange={(e) => updateField('shippingAmount', e.target.value)} className="accent-[#C9A84C]" />
                    <span className="text-xs text-[#F5F5F5]">Ship Full Asset</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 border border-[#212836] rounded cursor-pointer hover:border-[#C9A84C]/30 transition-colors">
                    <input type="radio" name="shippingAmount" value="ship_partial" checked={form.shippingAmount === 'ship_partial'} onChange={(e) => updateField('shippingAmount', e.target.value)} className="accent-[#C9A84C]" />
                    <span className="text-xs text-[#F5F5F5]">Ship Partial</span>
                  </label>
                  {form.shippingAmount === 'ship_partial' && (
                    <input type="number" value={form.partialGrams} onChange={(e) => updateField('partialGrams', e.target.value)} className="input-aurum" placeholder="Grams to ship" min="0.1" step="0.1" />
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-2">
                  <p className="text-xs text-[#8A8A8E] font-bold mb-1">DELIVERY DETAILS</p>
                  <input type="text" value={form.deliveryName} onChange={(e) => updateField('deliveryName', e.target.value)} className="input-aurum" placeholder="Recipient Name" />
                  <input type="tel" value={form.deliveryPhone} onChange={(e) => updateField('deliveryPhone', e.target.value)} className="input-aurum" placeholder="Phone Number" />
                  <input type="text" value={form.deliveryAddress} onChange={(e) => updateField('deliveryAddress', e.target.value)} className="input-aurum" placeholder="Delivery Address" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={form.deliveryCity} onChange={(e) => updateField('deliveryCity', e.target.value)} className="input-aurum" placeholder="City" />
                    <input type="text" value={form.deliveryPostcode} onChange={(e) => updateField('deliveryPostcode', e.target.value)} className="input-aurum" placeholder="ZIP/Postcode" />
                  </div>
                  <input type="text" value={form.deliveryCountry} onChange={(e) => updateField('deliveryCountry', e.target.value)} className="input-aurum" placeholder="Country" />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3">
                  <p className="text-xs text-[#8A8A8E] font-bold mb-1">REVIEW & TERMS</p>
                  <div className="p-3 bg-[#1b212c] border border-[#212836] rounded space-y-1 text-[11px]">
                    <p className="text-[#F5F5F5]">Type: <span className="text-[#C9A84C]">{selectedTypeLabel}</span></p>
                    <p className="text-[#F5F5F5]">Location: <span className="text-[#C9A84C]">{selectedGroup?.label || form.assetId}</span></p>
                    <p className="text-[#F5F5F5]">Weight: <span className="text-[#C9A84C]">{selectedGroup?.totalWeight || 0}g</span></p>
                    <p className="text-[#F5F5F5]">Shipping: <span className="text-[#C9A84C]">{form.shippingAmount === 'ship_full' ? 'Full' : `Partial (${form.partialGrams}g)`}</span></p>
                    <p className="text-[#F5F5F5]">To: <span className="text-[#C9A84C]">{form.deliveryName}, {form.deliveryCity}</span></p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.agreedTerms} onChange={(e) => updateField('agreedTerms', e.target.checked)} className="accent-[#C9A84C]" />
                    <span className="text-[10px] text-[#8A8A8E]">I agree to the shipment terms, insurance requirements, and delivery fees.</span>
                  </label>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <p className="text-xs text-[#8A8A8E] font-bold mb-2">FEES</p>
                  <p className="text-[10px] text-[#8A8A8E]">Review the fees for your shipment.</p>
                  
                  <div className="p-3 bg-[#1b212c] border border-[#212836] rounded space-y-2 text-[11px]">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#212836]">
                      {form.assetType === 'bar' && (
                        <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="7" width="18" height="10" rx="1" />
                          <path d="M5 7L6 4h12l1 3" strokeWidth="1" stroke="currentColor" fill="none" />
                        </svg>
                      )}
                      {form.assetType === 'coin' && (
                        <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" fill="currentColor" />
                          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
                          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                          <path d="M10 12h4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                        </svg>
                      )}
                      {form.assetType === 'jewellery' && (
                        <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z" />
                          <rect x="11" y="16" width="2" height="4" />
                          <path d="M9 20h6" strokeWidth="1" stroke="currentColor" fill="none" />
                        </svg>
                      )}
                      <div className="flex-1">
                        <p className="text-[#8A8A8E]">{selectedTypeLabel}</p>
                        <p className="text-[#C9A84C] font-semibold">{selectedGroup?.label || '—'} ({selectedGroup?.totalWeight || 0}g)</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-[#8A8A8E]">Type</span>
                      <span className="text-[#F5F5F5]">{form.shippingAmount === 'ship_full' ? 'Ship All' : `Partial (${form.partialGrams}g)`}</span>
                    </div>
                    
                    <div className="space-y-1 border-t border-[#212836] pt-2">
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8E]">Asset Value (Live Price)</span>
                        <span className="text-[#F5F5F5]">${Math.round(shipmentAssetValue * 100) / 100}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8E]">Shipment Fee (0.25%)</span>
                        <span className="text-[#F5F5F5]">${calculatedShipmentFee.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between border-t border-[#212836] pt-2 font-semibold">
                      <span className="text-[#C9A84C]">Total Fee</span>
                      <span className="text-[#C9A84C] text-sm">${calculatedShipmentFee.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 p-2 bg-[#1b212c] border border-[#212836] rounded">
                    <svg className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <text x="12" y="16" textAnchor="middle" fontSize="14" fill="#10141d" fontWeight="bold">i</text>
                    </svg>
                    <p className="text-[9px] text-[#8A8A8E]">Fees non-refundable once confirmed.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                {step > 1 && (
                  <button onClick={() => setStep(step - 1)} className="flex-1 btn-gold-outline text-xs">
                    BACK
                  </button>
                )}
                <button onClick={handleNext} className="flex-1 btn-gold text-xs" disabled={loading}>
                  {loading ? 'Processing...' : step >= 5 ? 'CONFIRM & PROCEED' : 'Next'}
                </button>
              </div>
            </div>
        </div>
      </div>
      
      {showCheckout && checkoutData && (
        <CryptoCheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          amount={checkoutData.amount}
          description={checkoutData.description}
          orderId={checkoutData.orderId}
          initialEmail={checkoutData.initialEmail}
          onPaymentSuccess={() => {
            onToast('Payment confirmed! Processing your shipment.', 'success');
            handleClose();
          }}
        />
      )}
    </div>
  );
}
