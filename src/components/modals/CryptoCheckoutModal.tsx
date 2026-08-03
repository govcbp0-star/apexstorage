import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, CheckCircle2, Loader2, Info, Timer } from 'lucide-react';
import QRCode from 'react-qr-code';
import { createPayment, getPaymentStatus, NOWPaymentResponse } from '@/lib/nowpayments-service';
import { ref, get, update, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '@/lib/firebase';

interface CryptoCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  orderId: string;
  initialEmail: string;
  onPaymentSuccess: () => void;
}

const CRYPTO_OPTIONS = [
  { id: 'usdterc20', name: 'USDT', desc: 'Tether USD (ERC20)', icon: 'T', color: '#26A17B' },
  { id: 'btc', name: 'BTC', desc: 'Bitcoin', icon: '₿', color: '#F7931A' },
  { id: 'eth', name: 'ETH', desc: 'Ethereum', icon: 'Ξ', color: '#627EEA' },
  { id: 'usdc', name: 'USDC', desc: 'USD Coin', icon: '$', color: '#2775CA' },
];

export function CryptoCheckoutModal({
  isOpen,
  onClose,
  amount,
  description,
  orderId,
  initialEmail,
  onPaymentSuccess,
}: CryptoCheckoutModalProps) {
  const [selectedCrypto, setSelectedCrypto] = useState('usdterc20');
  const [email] = useState(initialEmail);
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [showSecondary, setShowSecondary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<NOWPaymentResponse | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('waiting');
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  const paymentDataRef = useRef(paymentData);
  paymentDataRef.current = paymentData;

  // Sync emails to Firebase
  const saveEmailsToFirebase = async (secEmail: string) => {
    try {
      const txRef = ref(db, 'transactions');
      const q = query(txRef, orderByChild('orderId'), equalTo(orderId));
      const snapshot = await get(q);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const txKey = Object.keys(data)[0];
        await update(ref(db, `transactions/${txKey}`), {
          userEmail: email,
          secondaryEmail: secEmail,
          metadata: {
            ...data[txKey].metadata,
            secondaryEmail: secEmail
          }
        });
      } else {
        const allSnapshot = await get(txRef);
        if (allSnapshot.exists()) {
          const allData = allSnapshot.val();
          for (const key in allData) {
            if (allData[key].metadata?.orderId === orderId) {
              await update(ref(db, `transactions/${key}`), {
                userEmail: email,
                secondaryEmail: secEmail,
                metadata: {
                  ...allData[key].metadata,
                  secondaryEmail: secEmail
                }
              });
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to save emails to Firebase:", err);
    }
  };

  // Initial load and currency change
  useEffect(() => {
    if (!isOpen) return;
    
    let isMounted = true;
    
    const fetchPayment = async () => {
      if (!email) return;
      setIsLoading(true);
      try {
        const data = await createPayment({
          amount,
          description,
          orderId,
          userEmail: email,
          payCurrency: selectedCrypto
        });
        if (isMounted) {
          setPaymentData(data);
          setPaymentStatus('waiting');
        }
      } catch (error: any) {
        if (isMounted) console.error("Failed to generate payment:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPayment();
    
    return () => { isMounted = false; };
  }, [isOpen, selectedCrypto]);

  // Countdown timer
  useEffect(() => {
    if (!paymentData || paymentStatus !== 'waiting') return;
    
    // 30 minutes expiration from creation
    const createdAt = new Date(paymentData.created_at).getTime();
    const validUntil = createdAt + 30 * 60 * 1000;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = validUntil - now;
      
      if (distance <= 0) {
        setTimeLeft('Expired');
        return;
      }
      
      const minutes = Math.floor(distance / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [paymentData, paymentStatus]);

  // Polling for payment status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isOpen && paymentData && paymentData.payment_id && paymentStatus === 'waiting') {
      interval = setInterval(async () => {
        try {
          const status = await getPaymentStatus(paymentData.payment_id);
          if (status.payment_status === 'finished' || status.payment_status === 'sending' || status.payment_status === 'confirming') {
            setPaymentStatus('success');
            if (status.payment_status === 'finished' || status.payment_status === 'sending') {
              clearInterval(interval);
              setTimeout(() => {
                onPaymentSuccess();
                onClose();
              }, 2000);
            }
          } else if (status.payment_status === 'expired' || status.payment_status === 'failed') {
             setPaymentStatus(status.payment_status);
          }
        } catch (error) {
          console.error("Error polling payment status:", error);
        }
      }, 10000); // poll every 10s
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, paymentData, paymentStatus, onPaymentSuccess, onClose]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleManualCheck = async () => {
    if (!paymentData) return;
    try {
      if (secondaryEmail) {
        await saveEmailsToFirebase(secondaryEmail);
      }
      const status = await getPaymentStatus(paymentData.payment_id);
      if (status.payment_status === 'finished' || status.payment_status === 'sending' || status.payment_status === 'confirming') {
        setPaymentStatus('success');
      } else {
        alert("Payment not detected yet. We are continuing to monitor the blockchain in the background.");
      }
    } catch(err) {
      alert("Could not check status right now. Please wait.");
    }
  };

  if (!isOpen) return null;

  const currentOption = CRYPTO_OPTIONS.find(c => c.id === selectedCrypto)!;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-[360px] bg-[#0D1117] border border-[#21262D] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 pt-3 pb-1.5">
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Payment</h2>
            <p className="text-[9px] text-[#8B949E]">Complete your payment securely.</p>
          </div>
          <button onClick={onClose} className="text-[#8B949E] hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          
          {/* Amount Due & Pay With */}
          <div className="flex gap-3 mb-2">
            <div className="flex-1">
              <p className="text-[8px] text-[#8B949E] font-semibold uppercase tracking-wider mb-0.5">Amount Due</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-[#F2A900]">${amount.toFixed(2)}</span>
                <span className="text-[8px] font-semibold text-[#8B949E] bg-[#161B22] px-1 py-0.5 rounded">USD</span>
              </div>
            </div>
            
            <div className="flex-1">
              <p className="text-[8px] text-[#8B949E] font-semibold uppercase tracking-wider mb-0.5">Pay With</p>
              <div className="relative">
                <select
                  value={selectedCrypto}
                  onChange={(e) => setSelectedCrypto(e.target.value)}
                  className="w-full appearance-none bg-[#161B22] border border-[#F2A900]/50 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#F2A900] transition-colors pl-7"
                >
                  {CRYPTO_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 rounded-full" style={{backgroundColor: currentOption.color}}>
                   <span className="text-white text-[7px] font-bold">{currentOption.icon}</span>
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B949E]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Email (locked) */}
          <input
            type="email"
            value={email}
            disabled
            className="w-full bg-[#161B22]/40 border border-[#21262D]/60 rounded-lg px-3 py-1 text-[11px] text-[#8B949E] cursor-not-allowed focus:outline-none mb-1.5"
          />

          {/* Secondary Email Toggle */}
          <div className="mb-2">
             <div className="flex items-center gap-1.5">
               <input
                 type="checkbox"
                 id="add-secondary-email"
                 checked={showSecondary}
                 onChange={(e) => setShowSecondary(e.target.checked)}
                 className="w-3 h-3 rounded border-[#21262D] bg-[#161B22] text-[#F2A900] focus:ring-0 focus:ring-offset-0 cursor-pointer"
               />
               <label htmlFor="add-secondary-email" className="text-[9px] text-[#8B949E] hover:text-white transition-colors cursor-pointer select-none">
                 Add secondary notification email
               </label>
             </div>
             {showSecondary && (
               <input
                 type="email"
                 placeholder="Enter secondary email"
                 value={secondaryEmail}
                 onChange={(e) => setSecondaryEmail(e.target.value)}
                 onBlur={() => saveEmailsToFirebase(secondaryEmail)}
                 className="w-full bg-[#161B22] border border-[#21262D] rounded-lg px-3 py-1 text-[11px] text-white placeholder-[#8B949E] focus:outline-none focus:border-[#F2A900] transition-colors mt-1.5"
               />
             )}
          </div>

          {/* Inner Payment Panel */}
          <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-2.5">
            {isLoading || !paymentData ? (
              <div className="flex flex-col items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#F2A900] mb-2" />
                <p className="text-[10px] text-[#8B949E]">Generating payment details...</p>
              </div>
            ) : paymentStatus === 'success' ? (
               <div className="flex flex-col items-center justify-center py-5 text-center">
                 <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                 <h3 className="text-white font-bold text-sm mb-0.5">Payment Confirmed!</h3>
                 <p className="text-[#8B949E] text-[10px]">Your order is now being processed.</p>
               </div>
            ) : (
              <div className="flex flex-col items-center">
                <p className="text-[8px] text-[#8B949E] font-semibold uppercase tracking-wider mb-1.5">Scan To Pay</p>
                
                <div className="bg-white p-1.5 rounded-lg mb-2 relative">
                  <QRCode value={paymentData.pay_address} size={90} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center" style={{backgroundColor: currentOption.color}}>
                     <span className="text-white text-[8px] font-bold">{currentOption.icon}</span>
                  </div>
                </div>

                <p className="text-[7px] text-[#8B949E] font-semibold uppercase tracking-wider mb-1 text-center">Or Send To Wallet Address</p>

                {/* Address Box */}
                <div className="w-full flex items-center bg-[#0D1117] border border-[#21262D] rounded-lg px-2 py-1.5 mb-1.5 group hover:border-[#8B949E]/50 transition-colors cursor-pointer" onClick={() => copyToClipboard(paymentData.pay_address)}>
                  <p className="text-[9px] text-white font-mono font-bold truncate flex-1 mr-2">{paymentData.pay_address}</p>
                  {copiedAddress ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> : <Copy className="w-3 h-3 text-[#F2A900] shrink-0" />}
                </div>

                {/* Details Grid */}
                <div className="w-full grid grid-cols-3 gap-1 bg-[#0D1117] border border-[#21262D] rounded-lg px-2 py-1.5 mb-1.5">
                  <div className="flex flex-col">
                    <span className="text-[7px] text-[#8B949E]">Network</span>
                    <span className="text-[9px] text-white font-medium uppercase">{currentOption.id.replace(currentOption.name.toLowerCase(), '') || currentOption.name}</span>
                  </div>
                  <div className="flex flex-col text-center">
                    <span className="text-[7px] text-[#8B949E]">Amount</span>
                    <span className="text-[9px] text-white font-medium">{paymentData.pay_amount} <span className="uppercase">{paymentData.pay_currency}</span></span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[7px] text-[#8B949E]">Confirmations</span>
                    <span className="text-[9px] text-white font-medium">Auto</span>
                  </div>
                </div>

                {/* Info */}
                <div className="w-full flex items-center justify-center gap-1">
                  <Info className="w-2.5 h-2.5 text-[#F2A900]" />
                  <span className="text-[8px] text-[#8B949E]">Send exact amount. Confirmed automatically.</span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        {paymentData && paymentStatus === 'waiting' && !isLoading && (
          <div className="px-4 py-2 border-t border-[#21262D] flex items-center justify-between bg-[#161B22] rounded-b-xl">
            <div className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-[#8B949E]" />
              <div className="flex flex-col">
                 <span className="text-[8px] text-[#8B949E]">Expires in</span>
                 <span className="text-[11px] font-bold text-[#F2A900]">{timeLeft}</span>
              </div>
            </div>
            
            <button 
              onClick={handleManualCheck}
              className="px-3.5 py-1.5 border border-[#F2A900] text-[#F2A900] text-[9px] font-bold rounded-lg hover:bg-[#F2A900]/10 transition-colors"
            >
              I'VE PAID
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
