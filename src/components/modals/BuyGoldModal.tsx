'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { submitOrder } from '@/lib/orders-service';
import { submitTransaction } from '@/lib/transactions-service';
import { CryptoCheckoutModal } from './CryptoCheckoutModal';

interface BuyGoldModalProps {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  goldSpotPrice: number;
}

export default function BuyGoldModal({ open, onClose, onToast, goldSpotPrice }: BuyGoldModalProps) {
  const { user, userProfile } = useAuth();
  const [productType, setProductType] = useState('');
  const [quantityGrams, setQuantityGrams] = useState('');
  const [quantityOz, setQuantityOz] = useState('');
  const [vault, setVault] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);

  const handleClose = () => {
    setResetKey((k) => k + 1);
    onClose();
  };

  const calculateOzFromGrams = (g: string) => {
    const val = parseFloat(g) || 0;
    setQuantityGrams(g);
    setQuantityOz((val / 31.1035).toFixed(4));
  };

  const calculateGramsFromOz = (oz: string) => {
    const val = parseFloat(oz) || 0;
    setQuantityOz(oz);
    setQuantityGrams((val * 31.1035).toFixed(2));
  };

  const estimatedTotal = (() => {
    const g = parseFloat(quantityGrams) || 0;
    const oz = parseFloat(quantityOz) || 0;
    const ozCalc = oz || (g / 31.1035) || 0;
    return ozCalc * goldSpotPrice;
  })();

  const handleSubmit = async () => {
    if (!productType || !vault) { onToast('Select product and vault', 'error'); return; }
    const g = parseFloat(quantityGrams.replace(',', '.'));
    const oz = parseFloat(quantityOz.replace(',', '.'));
    const hasG = !isNaN(g) && g > 0;
    const hasOz = !isNaN(oz) && oz > 0;
    if (!hasG && !hasOz) { onToast('Enter a positive quantity in grams or ounces', 'error'); return; }
    if (hasG && g < 0.1) { onToast('Minimum order is 0.1g', 'error'); return; }
    if (hasOz && oz < 0.001) { onToast('Minimum order is 0.001 oz', 'error'); return; }

    setLoading(true);
    try {
      const orderData = {
        userName: userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Unknown',
        userId: user?.uid || '',
        userEmail: user?.email || '',
        type: 'Buy Gold',
        productType,
        quantityGrams: hasG ? g : parseFloat((oz * 31.1035).toFixed(2)),
        quantityOz: hasOz ? oz : parseFloat((g / 31.1035).toFixed(4)),
        vault,
        estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      };
      
      const orderId = `${user?.uid || 'user'}_order_${Date.now()}`;
      
      // 1. Create order record with pending payment status
      const savedOrderId = await submitOrder({
        ...orderData,
        orderId,
        paymentMethod: 'crypto',
        paymentStatus: 'pending',
      });

      const description = `Buy ${productType} - ${orderData.quantityGrams}g`;

      // 2. Create transaction record mapped to order
      await submitTransaction({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: orderData.userName,
        type: 'gold_purchase',
        description,
        amount: orderData.estimatedTotal,
        currency: 'usd',
        cryptoCurrency: '',
        cryptoAmount: 0,
        paymentId: '',
        paymentStatus: 'pending',
        orderId: savedOrderId,
        metadata: {
          orderId: savedOrderId,
        },
      });

      // 3. Open Custom Checkout
      setCheckoutData({
        amount: orderData.estimatedTotal,
        description,
        orderId: savedOrderId,
        initialEmail: user?.email || '',
      });
      setShowCheckout(true);
    } catch (err: any) {
      onToast('Failed to create order. Please try again.', 'error');
      console.error('Order creation error:', err);
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
            <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">BUY GOLD</h3>
            <button onClick={handleClose} className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2">
            <div className="p-2.5 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-[11px] text-[#C9A84C] font-bold">
                Spot: ${goldSpotPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz
              </span>
            </div>
            <div key={resetKey}>
              <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Product Type</label>
              <div className="relative">
                <select value={productType} onChange={(e) => setProductType(e.target.value)} className="input-aurum w-full appearance-none pr-8" required>
                  <option value="">Select product</option>
                  <option value="bar">Gold Bar</option>
                  <option value="coin">Gold Coin</option>
                  <option value="jewellery">Jewellery</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8A8A8E]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {/* Icon display based on selected product type */}
              {productType && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-[#1b212c] border border-[#212836] rounded">
                  {productType === 'bar' && (
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="7" width="18" height="10" rx="1" />
                      <path d="M5 7L6 4h12l1 3" strokeWidth="1" stroke="currentColor" fill="none" />
                    </svg>
                  )}
                  {productType === 'coin' && (
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" fill="currentColor" />
                      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
                      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                      <path d="M10 12h4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                    </svg>
                  )}
                  {productType === 'jewellery' && (
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z" />
                      <rect x="11" y="16" width="2" height="4" />
                      <path d="M9 20h6" strokeWidth="1" stroke="currentColor" fill="none" />
                    </svg>
                  )}
                  <span className="text-xs text-[#F5F5F5]">
                    {productType === 'bar' ? 'Gold Bar' : productType === 'coin' ? 'Gold Coin' : 'Jewellery'}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Grams</label>
                <input type="number" value={quantityGrams} onChange={(e) => calculateOzFromGrams(e.target.value)} className="input-aurum" placeholder="0" min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Ounces</label>
                <input type="number" value={quantityOz} onChange={(e) => calculateGramsFromOz(e.target.value)} className="input-aurum" placeholder="0" min="0" step="0.001" />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Vault</label>
              <select value={vault} onChange={(e) => setVault(e.target.value)} className="input-aurum" required>
                <option value="">Select vault</option>
                <option value="zurich">Zurich</option>
                <option value="singapore">Singapore</option>
                <option value="london">London</option>
                <option value="newyork">New York</option>
              </select>
            </div>
            <div className="p-2.5 bg-[#1b212c] border border-[#212836] rounded">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider">Estimated Total</span>
                <span className="text-lg font-bold text-[#C9A84C]">
                  ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <button onClick={handleSubmit} className="w-full btn-gold text-xs" disabled={loading}>
              {loading ? 'Processing...' : 'Place Order'}
            </button>
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
            onToast('Payment confirmed! Processing your order.', 'success');
            handleClose();
          }}
        />
      )}
    </div>
  );
}
