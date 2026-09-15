'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AuthModal from '@/components/modals/AuthModal';
import GetVaultModal from '@/components/modals/GetVaultModal';
import BuyGoldModal from '@/components/modals/BuyGoldModal';
import ShipmentWizard from '@/components/modals/ShipmentWizard';
import PerformanceChart from '@/components/modals/PerformanceChart';
import { formatNumber } from '@/lib/gold-price';
import type { Chart as ChartJS } from 'chart.js';

// Toast component
function Toast({ message, type, visible }: { message: string; type: string; visible: boolean }) {
  if (!visible) return null;
  const colors: Record<string, string> = {
    success: 'bg-green-500/10 border-green-500/20 text-green-500',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    info: 'bg-[#38BDF8]/10 border-[#38BDF8]/20 text-[#38BDF8]',
  };
  return (
    <div className={`fixed bottom-6 right-6 z-[200] px-4 py-2.5 border rounded-lg ${colors[type] || colors.info} text-xs font-medium tracking-wide animate-[fadeIn_0.3s_ease-out]`}>
      {message}
    </div>
  );
}

export default function HomePage() {
  const { authRole, pending2FA } = useAuth();
  const router = useRouter();

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [getVaultModalOpen, setGetVaultModalOpen] = useState(false);
  const [buyGoldModalOpen, setBuyGoldModalOpen] = useState(false);
  const [shipmentWizardOpen, setShipmentWizardOpen] = useState(false);
  const [performanceChartOpen, setPerformanceChartOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }, []);

  // Gold price
  const [goldSpotPrice, setGoldSpotPrice] = useState(4744.08);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [priceLabels, setPriceLabels] = useState<string[]>([]);
  const [goldPriceUpdated, setGoldPriceUpdated] = useState('');
  const [priceChange, setPriceChange] = useState(0);

  // Hero carousel
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ['hero-1.png', 'hero-2.png', 'hero-3.png'];

  // Stats animation
  const [stats, setStats] = useState({ assets: 0, clients: 0, uptime: 0 });

  // ROI Calculator state
  const [investmentAmount, setInvestmentAmount] = useState<number>(10000);
  const [years, setYears] = useState<number>(5);
  const [annualReturn, setAnnualReturn] = useState<number>(7.5);

  // Gold chart canvas ref
  const goldChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<ChartJS<'line'> | null>(null);

  // Demo assets for modals
  const demoAssets = [
    { id: '1', ref: 'GB-001', type: 'bar', weight: 500, status: 'active' },
    { id: '2', ref: 'GC-015', type: 'coin', weight: 125, status: 'active' },
    { id: '3', ref: 'GB-042', type: 'bar', weight: 250, status: 'pending' },
    { id: '4', ref: 'JW-008', type: 'jewellery', weight: 75, status: 'active' },
  ];

  // Fetch gold price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/gold-price');
        const data = await res.json();
        setGoldSpotPrice(data.price);
        setPriceChangePercent(data.changePercent || 0);
        setPriceChange(data.change || 0);
        setGoldPriceUpdated(data.lastUpdated || '');
        if (data.priceHistory?.length > 0) {
          setPriceHistory(data.priceHistory);
          setPriceLabels(data.labels || []);
        }
      } catch {
        // Use defaults
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 45000);
    return () => clearInterval(interval);
  }, []);

  // Hero carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [slides.length]);

  // Stats animation
  useEffect(() => {
    const duration = 2000;
    const start = performance.now();
    const targets = { assets: 2.4, clients: 100, uptime: 99.9 };
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setStats({
        assets: parseFloat((eased * targets.assets).toFixed(1)),
        clients: Math.round(eased * targets.clients),
        uptime: parseFloat((eased * targets.uptime).toFixed(1)),
      });
      if (progress < 1) requestAnimationFrame(step);
    };
    const timer = setTimeout(() => requestAnimationFrame(step), 600);
    return () => clearTimeout(timer);
  }, []);

  // Redirect logged-in users
  useEffect(() => {
    if (pending2FA) {
      router.push('/auth/login');
    } else if (authRole === 'client') {
      router.push('/dashboard/client');
    } else if (authRole === 'admin') {
      router.push('/dashboard/admin');
    }
  }, [authRole, pending2FA, router]);

  // ROI Calculator functions
  const calculateProjectedValue = () => {
    return investmentAmount * Math.pow(1 + annualReturn / 100, years);
  };

  const calculateOunces = () => {
    if (goldSpotPrice <= 0) return '0.00';
    return (investmentAmount / goldSpotPrice).toFixed(2);
  };

  const calculateSp500Value = () => {
    return investmentAmount * Math.pow(1 + 0.10, years);
  };

  const calculateSavingsValue = () => {
    return investmentAmount * Math.pow(1 + 0.04, years);
  };

  const projectedValue = calculateProjectedValue();
  const sp500Value = calculateSp500Value();
  const savingsValue = calculateSavingsValue();
  const totalReturn = ((projectedValue - investmentAmount) / investmentAmount * 100).toFixed(1);

  // Draw gold price mini chart
  useEffect(() => {
    if (!goldChartRef.current || priceHistory.length === 0) return;

    const drawChart = async () => {
      const { Chart, LineController, LineElement, PointElement, LinearScale, Filler, CategoryScale } = await import('chart.js');
      Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, CategoryScale);

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = goldChartRef.current?.getContext('2d');
      if (!ctx) return;

      const gradient = ctx.createLinearGradient(0, 0, 0, 160);
      gradient.addColorStop(0, 'rgba(200, 162, 75, 0.28)');
      gradient.addColorStop(1, 'rgba(200, 162, 75, 0)');

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: priceLabels.length > 0 ? priceLabels : priceHistory.map((_, i) => `${i + 1}`),
          datasets: [{
            data: priceHistory,
            borderColor: '#E3C878',
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#E3C878',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#161109',
              borderColor: '#2A2114',
              borderWidth: 1,
              titleColor: '#EFE7D8',
              bodyColor: '#E3C878',
              bodyFont: { weight: 'bold' },
              padding: 8,
              displayColors: false,
              callbacks: {
                label: (ctx: { raw: unknown }) => '$' + Number(ctx.raw).toFixed(2),
              },
            },
          },
          scales: {
            x: {
              display: true,
              ticks: { color: '#8C8272', font: { size: 9 }, maxTicksLimit: 6 },
              grid: { color: 'rgba(42, 33, 20, 0.35)' },
              border: { color: '#2A2114' },
            },
            y: {
              display: true,
              min: priceHistory.length > 0 ? Math.floor(Math.min(...priceHistory) * 0.995) : undefined,
              max: priceHistory.length > 0 ? Math.ceil(Math.max(...priceHistory) * 1.005) : undefined,
              ticks: {
                color: '#8C8272',
                font: { size: 9 },
                callback: (val: string | number) => `$${Number(val).toLocaleString()}`,
              },
              grid: { color: 'rgba(42, 33, 20, 0.35)' },
              border: { color: '#2A2114' },
            },
          },
          interaction: {
            intersect: false,
            mode: 'index',
          },
        },
      });
    };

    drawChart();

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [priceHistory, priceLabels]);

  return (
    <div className="bg-[#0D0B07] min-h-screen">
      <Navbar />
      <AuthModal
        open={authModalOpen}
        mode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onModeChange={setAuthMode}
      />
      <GetVaultModal open={getVaultModalOpen} onClose={() => setGetVaultModalOpen(false)} onToast={showToast} />
      <BuyGoldModal open={buyGoldModalOpen} onClose={() => setBuyGoldModalOpen(false)} onToast={showToast} goldSpotPrice={goldSpotPrice} />
      <ShipmentWizard open={shipmentWizardOpen} onClose={() => setShipmentWizardOpen(false)} onToast={showToast} assets={demoAssets} goldSpotPrice={goldSpotPrice} />
      <PerformanceChart
        open={performanceChartOpen}
        onClose={() => setPerformanceChartOpen(false)}
        priceHistory={priceHistory}
        labels={priceLabels}
        currentPrice={goldSpotPrice}
      />
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <main>
        {/* Hero Section */}
        <section id="home" className="relative min-h-screen flex items-center overflow-hidden bg-[#0D0B07]">
          <div className="absolute inset-0">
            {slides.map((image, index) => (
              <div
                key={image}
                className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ${
                  currentSlide === index ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                }`}
                style={{ backgroundImage: `url('/images/${image}')` }}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0D0B07]/95 via-[#0D0B07]/80 to-[#0D0B07]/60" />
            <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-[#0D0B07] to-transparent" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-28 w-full">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 animate-[slideUp_0.6s_ease-out]">
                <h1 className="display-head text-4xl sm:text-6xl lg:text-[4.1rem] leading-[1.02] mb-6">
                  Your gold, held<br />
                  <span className="gold-gradient-text">to the gram.</span>
                </h1>
                <p className="text-[#B9AE9B] text-base sm:text-lg max-w-md sm:max-w-none lg:max-w-md mb-9 leading-relaxed">
                  Allocated bars and coins in LBMA-approved vaults — weighed, sealed, and recorded to your account. Verify, ship, or sell anytime.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setGetVaultModalOpen(true)} className="btn-gold">
                    Open a vault
                    <svg className="inline-block ml-1.5 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m0-4H3" />
                    </svg>
                  </button>
                  <button onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }} className="btn-gold-outline text-center">
                    Sign in
                  </button>
                </div>
                <div className="mt-10 sm:mt-12 max-w-md sm:max-w-none lg:max-w-md border-t border-[#2A2114] pt-6 grid grid-cols-3 gap-6">
                  <div>
                    <div className="ledger-val text-2xl font-semibold">${stats.assets}B</div>
                    <div className="ledger-key mt-1.5">Assets in custody</div>
                  </div>
                  <div>
                    <div className="ledger-val text-2xl font-semibold">{stats.clients}K+</div>
                    <div className="ledger-key mt-1.5">Clients</div>
                  </div>
                  <div>
                    <div className="ledger-val text-2xl font-semibold">{stats.uptime}%</div>
                    <div className="ledger-key mt-1.5">Vault availability</div>
                  </div>
                </div>
              </div>

              {/* Signature: live assay certificate */}
              <div className="lg:col-span-5 hidden lg:block animate-[fadeIn_0.9s_ease-out]">
                <div className="relative max-w-sm mx-auto">
                  <div className="absolute -inset-3 border border-[#C8A24B]/15" />
                  <div className="absolute -inset-6 border border-[#C8A24B]/[0.07]" />
                  <div className="assay-cert relative p-7">
                    <div className="flex items-start justify-between gap-4 pb-5 border-b cert-rule">
                      <div>
                        <div className="display-head text-xl font-semibold cert-ink leading-none tracking-tight">APEXSTORAGE</div>
                        <div className="ledger-key cert-muted mt-2" style={{ letterSpacing: '0.34em' }}>Assay · Bullion</div>
                      </div>
                      <div
                        className="hallmark w-14 h-14 text-[8px] shrink-0"
                        style={{ animation: 'stampIn 0.7s cubic-bezier(.2,.8,.3,1.1) 0.5s both' }}
                      >
                        <div className="text-center leading-tight">
                          <div className="tracking-[0.16em]">LBMA</div>
                          <div className="text-[11px]">999.9</div>
                          <div className="tracking-[0.12em] text-[7px] opacity-70">FINE</div>
                        </div>
                      </div>
                    </div>
                    <div className="py-5 space-y-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="ledger-key cert-muted">Spot · troy oz</span>
                        <span className="ledger-val cert-ink text-xl font-semibold">${formatNumber(goldSpotPrice)}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="ledger-key cert-muted">24-hour change</span>
                        <span className={`ledger-val text-sm font-semibold ${priceChange >= 0 ? 'text-[#3E6A4E]' : 'text-[#8A4A2B]'}`}>
                          {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChangePercent).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="ledger-key cert-muted">Fineness</span>
                        <span className="ledger-val cert-ink text-sm">999.9 fine</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="ledger-key cert-muted">Vault</span>
                        <span className="ledger-val cert-ink text-sm">Zurich · CH</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t cert-rule">
                      <span className="ledger-key cert-muted">Rec. no. AS-88421</span>
                      <span className="ledger-val cert-ink text-[10px] tracking-[0.2em]">VERIFIED</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-center mt-7">
                    <span className="live-dot" />
                    <span className="ledger-key">Live assay · refreshes every 45s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live ticker — the market tape as a ledger line */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-[#2A2114] bg-[#0D0B07]/85 backdrop-blur-sm overflow-hidden">
            <div className="ticker-track">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex items-center shrink-0" aria-hidden={dup === 1}>
                  {[
                    { k: 'SPOT', v: `$${formatNumber(goldSpotPrice)}/oz`, c: priceChange >= 0 ? 'text-[#5F8B6E]' : 'text-[#B4633F]' },
                    { k: 'ZURICH', v: '150,000 KG CAP.' },
                    { k: 'LONDON', v: '400,000 KG CAP.' },
                    { k: 'SINGAPORE', v: '300,000 KG CAP.' },
                    { k: 'NEW YORK', v: '350,000 KG CAP.' },
                    { k: 'FINENESS', v: '999.9 FINE' },
                    { k: 'INSURANCE', v: "LLOYD'S OF LONDON" },
                    { k: 'AUDITS', v: 'QUARTERLY · INDEPENDENT' },
                  ].map((item, i) => (
                    <span key={i} className="flex items-center gap-2.5 px-6 py-2.5 text-[10px] whitespace-nowrap">
                      <span className="ledger-key">{item.k}</span>
                      <span className={`ledger-val text-[11px] ${item.c || ''}`}>{item.v}</span>
                      <span className="text-[#4A3B1F] pl-4">◆</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VAULT SERVICES */}
        <section id="services" className="py-16 sm:py-24 md:py-28 bg-[#0D0B07] border-t border-[#2A2114]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
              <span className="record-eyebrow justify-center">
                <span className="hallmark w-7 h-7 text-[7px]">LBMA</span>
                Rec. 01 — Vault services
              </span>
              <h2 className="display-head text-3xl sm:text-4xl mt-4 mb-4">Our vault <span className="gold-gradient-text">services</span></h2>
              <p className="text-[#8C8272] text-sm leading-relaxed">Complete end-to-end gold custody platform trusted by investors across 40+ countries.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-12 sm:mb-16">
              {[
                { code: 'SVC-01', icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085', title: 'Secure Storage', desc: 'LBMA-approved vaults with full insurance. Individual bar tracking & serial numbers.' },
                { code: 'SVC-02', icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z', title: 'Gold Purchasing', desc: 'Buy bars & coins at competitive premiums. LBMA Good Delivery refiners only.' },
                { code: 'SVC-03', icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12', title: 'Insured Delivery', desc: 'Worldwide armored delivery with real-time GPS tracking and full insurance.' },
                { code: 'SVC-04', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', title: 'Live Dashboard', desc: 'View live valuations, transaction history, and vault locations in real-time.' },
                { code: 'SVC-05', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z', title: 'Full Insurance', desc: "Lloyd's of London underwritten coverage for transit and storage." },
                { code: 'SVC-06', icon: 'M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12', title: 'Audit Reports', desc: 'Quarterly third-party audits with certificates of authenticity and weight.' },
              ].map((service, idx) => (
                <div key={service.title} className="bg-[#161109] border border-[#2A2114] p-5 hover:border-[#C8A24B]/40 transition-colors duration-300 group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 border border-[#C8A24B]/25 bg-[#C8A24B]/[0.07] flex items-center justify-center group-hover:bg-[#C8A24B]/15 transition-colors">
                      <svg className="w-5 h-5 text-[#C8A24B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={service.icon} />
                      </svg>
                    </div>
                    <span className="ledger-key">{service.code}</span>
                  </div>
                  <h3 className="text-[13px] font-semibold tracking-[0.12em] text-[#EFE7D8] uppercase mb-2">{service.title}</h3>
                  <p className="text-[#8C8272] text-xs leading-relaxed">{service.desc}</p>
                </div>
              ))}
            </div>

            {/* How It Works — a real sequence, so numbered stamps are earned */}
            <div className="border border-[#2A2114] bg-[#161109] p-5 sm:p-7 mb-12 sm:mb-16">
              <div className="flex items-center gap-3 justify-center mb-7">
                <span className="hallmark w-7 h-7 text-[7px]">04</span>
                <h3 className="ledger-key !text-[#C8A24B]">Sequence — how a vault opens</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { num: '01', title: 'Register', desc: 'Account & KYC' },
                  { num: '02', title: 'Buy or request', desc: 'Gold or vault' },
                  { num: '03', title: 'Store', desc: 'Allocated to your vault' },
                  { num: '04', title: 'Ship or hold', desc: 'Delivery or storage' },
                ].map((step) => (
                  <div key={step.num} className="text-center">
                    <div className="step-stamp w-11 h-11 flex items-center justify-center mx-auto mb-3">{step.num}</div>
                    <h4 className="text-xs font-semibold text-[#EFE7D8] uppercase tracking-[0.12em] mb-1">{step.title}</h4>
                    <p className="ledger-key !text-[9px]">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vault Network — capacities as ledger records */}
            <div className="border border-[#2A2114] bg-[#161109] mb-12 sm:mb-16">
              <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#2A2114]">
                <h3 className="ledger-key !text-[#C8A24B]">Global vault network</h3>
                <span className="ledger-key">4 sites · 1,200,000 kg</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4">
                {[
                  { name: 'Zurich', image: 'zurich.png', capacity: '150,000 kg' },
                  { name: 'Singapore', image: 'singapore.png', capacity: '300,000 kg' },
                  { name: 'London', image: 'london.jpg', capacity: '400,000 kg' },
                  { name: 'New York', image: 'new-york.png', capacity: '350,000 kg' },
                ].map((vault) => (
                  <div key={vault.name} className="flex items-center gap-3 p-4 sm:p-5 border-[#2A2114] [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-b-0 lg:[&:not(:last-child)]:border-r">
                    <img src={`/images/${vault.image}`} alt={vault.name} className="w-8 h-6 object-cover shrink-0" />
                    <div>
                      <div className="text-[13px] font-semibold text-[#EFE7D8] uppercase tracking-[0.1em]">{vault.name}</div>
                      <div className="ledger-key mt-0.5">{vault.capacity} capacity</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <div className="border border-[#C8A24B]/30 bg-[#161109] p-7 sm:p-10">
                <span className="hallmark w-12 h-12 text-[9px] mx-auto mb-5">
                  <span className="text-center leading-tight">
                    <span className="block tracking-[0.14em]">ASK</span>
                    <span className="block text-[7px] opacity-70">US</span>
                  </span>
                </span>
                <h3 className="display-head text-xl sm:text-2xl mb-3">Need more information?</h3>
                <p className="text-[#8C8272] text-xs sm:text-sm mb-6 max-w-md mx-auto leading-relaxed">Our team is ready to answer questions about vault storage, pricing, or custom solutions.</p>
                <a href="/contact" className="btn-gold px-8 py-3 inline-flex items-center justify-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Make an enquiry
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Gold Bars Section */}
        <section id="gold" className="py-16 sm:py-24 md:py-28 bg-[#161109]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-14">
              <span className="record-eyebrow justify-center">
                <span className="hallmark w-7 h-7 text-[7px]">999</span>
                Rec. 02 — Products
              </span>
              <h2 className="display-head text-3xl sm:text-4xl mt-4 mb-3">Invest in <span className="gold-gradient-text">physical gold</span></h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
              {[
                {
                  renderIcon: () => (
                    <svg className="w-10 h-10 text-[#C8A24B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {/* Top layer (diamond) */}
                      <path d="M12 3L2 8L12 13L22 8Z" />
                      {/* Middle layer (chevron) */}
                      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
                      {/* Bottom layer (chevron) */}
                      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
                    </svg>
                  ),
                  title: 'Gold Bars',
                  spec: '1g – 1kg · LBMA certified',
                },
                {
                  renderIcon: () => (
                    <svg className="w-10 h-10 text-[#C8A24B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {/* Right Stack (Behind) */}
                      {/* Bottom Coin */}
                      <path d="M11 17.5a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#161109" />
                      <ellipse cx="15" cy="17.5" rx="4" ry="1.8" fill="#161109" />
                      {/* Middle Coin */}
                      <path d="M11 14a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#161109" />
                      <ellipse cx="15" cy="14" rx="4" ry="1.8" fill="#161109" />
                      {/* Top Coin */}
                      <path d="M11 10.5a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#161109" />
                      <ellipse cx="15" cy="10.5" rx="4" ry="1.8" fill="#161109" />
                      {/* Left Stack (In Front - covers right stack) */}
                      {/* Bottom Coin */}
                      <path d="M5 14a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#161109" />
                      <ellipse cx="9" cy="14" rx="4" ry="1.8" fill="#161109" />
                      {/* Top Coin */}
                      <path d="M5 10.5a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#161109" />
                      <ellipse cx="9" cy="10.5" rx="4" ry="1.8" fill="#161109" />
                    </svg>
                  ),
                  title: 'Gold Coins',
                  spec: 'Krugerrand · Maple Leaf',
                },
                {
                  renderIcon: () => (
                    <svg className="w-10 h-10 text-[#C8A24B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {/* Outer Box */}
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      {/* Hinges on the left */}
                      <path d="M3 7H1.5C1.2 7 1 7.2 1 7.5v2c0 .3.2.5.5.5H3" />
                      <path d="M3 14H1.5c-.3 0-.5.2-.5.5v2c0 .3.2.5.5.5H3" />
                      {/* Four corner rivets (small gold dots) */}
                      <circle cx="6.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                      <circle cx="6.5" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
                      <circle cx="17.5" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
                      {/* Center dial (double circle) */}
                      <circle cx="12" cy="12" r="4.5" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      {/* Lever/Handle on the right */}
                      <rect x="17" y="10" width="1.5" height="4" rx="0.75" fill="currentColor" stroke="none" />
                    </svg>
                  ),
                  title: 'Vault Storage',
                  spec: '4 global locations',
                },
              ].map((product) => (
                <div key={product.title} className="bg-[#0D0B07] border border-[#2A2114] p-6 hover:border-[#C8A24B]/40 transition-colors duration-300 group">
                  <div className="w-16 h-10 mx-auto mb-5 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                    {product.renderIcon()}
                  </div>
                  <h3 className="text-[13px] font-semibold tracking-[0.12em] text-[#EFE7D8] uppercase text-center mb-1.5">{product.title}</h3>
                  <p className="text-center ledger-key !text-[9px]">{product.spec}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Invest Section */}
        <section id="invest" className="py-16 sm:py-24 md:py-28 bg-[#0D0B07]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 sm:gap-14 items-center">
              <div>
                <span className="record-eyebrow">
                  <span className="hallmark w-7 h-7 text-[7px]">AU</span>
                  Rec. 03 — Why gold
                </span>
                <h2 className="display-head text-3xl sm:text-4xl mt-4 mb-4">The ultimate <span className="gold-gradient-text">wealth hedge</span></h2>
                <p className="text-[#8C8272] text-sm mb-7 leading-relaxed">Gold has preserved wealth for over 5,000 years. The anchor of a resilient portfolio.</p>
                <div className="space-y-4">
                  {[
                    { title: 'Inflation protection', desc: 'Outpaces inflation over long periods' },
                    { title: 'Diversification', desc: 'Low correlation with stocks & bonds' },
                    { title: 'Global liquidity', desc: 'Tradeable 24/7 worldwide' },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3.5 border-b border-[#2A2114]/60 pb-4">
                      <div className="step-stamp w-7 h-7 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-[#5F8B6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#EFE7D8]">{item.title}</h4>
                        <p className="text-[#8C8272] text-xs mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-2 border border-[#C8A24B]/10" />
                <div className="relative bg-[#161109] border border-[#2A2114] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="ledger-key flex items-center gap-1.5">
                        <span className="live-dot" /> Spot · live
                      </p>
                      <p className="ledger-val text-2xl font-semibold mt-1.5">${formatNumber(goldSpotPrice)} / oz</p>
                      <p className="ledger-key mt-1">{goldPriceUpdated ? `Updated ${goldPriceUpdated}` : 'Loading…'}</p>
                    </div>
                    <div className={`flex items-center gap-1 ledger-val text-sm font-semibold ${priceChange >= 0 ? 'text-[#5F8B6E]' : 'text-[#B4633F]'}`}>
                      {priceChange >= 0 ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m0 0v11" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                      )}
                      <span>{Math.abs(priceChangePercent).toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="h-44">
                    <canvas ref={goldChartRef} className="w-full h-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROI Calculator Section */}
        <section id="security" className="py-16 sm:py-24 md:py-28 bg-[#161109] border-t border-b border-[#2A2114]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-14">
              <span className="record-eyebrow justify-center">
                <span className="hallmark w-7 h-7 text-[7px]">%</span>
                Rec. 04 — Investment tool
              </span>
              <h2 className="display-head text-3xl sm:text-4xl mt-4 tracking-tight">Gold investment <span className="gold-gradient-text">calculator</span></h2>
              <p className="text-[#8C8272] text-xs sm:text-sm mt-3 max-w-lg mx-auto">See how an investment could grow at today's gold prices. Historical gold has averaged ~7.5% annual return.</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 items-start">
              {/* Left Side - Inputs */}
              <div className="bg-[#0D0B07] border border-[#2A2114] p-5 sm:p-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#2A2114] mb-5">
                  <h3 className="ledger-key !text-[#C8A24B]">Investment details</h3>
                  <span className="ledger-key">USD</span>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block ledger-key mb-2">Investment amount (USD)</label>
                    <input
                      type="number"
                      value={investmentAmount || ''}
                      onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                      min={100}
                      step={100}
                      className="input-aurum"
                      placeholder="e.g. 10000"
                    />
                  </div>
                  <div>
                    <label className="block ledger-key mb-2">Time period</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 3, 5, 10].map((y) => (
                        <button
                          key={y}
                          onClick={() => setYears(y)}
                          className={`py-2 text-[11px] font-semibold tracking-wide uppercase transition-all ${years === y ? 'btn-gold !py-2 text-[11px]' : 'border border-[#2A2114] text-[#EFE7D8] hover:border-[#C8A24B]/50'}`}
                        >
                          {y}Y
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block ledger-key mb-2">Expected annual return</label>
                    <input
                      type="range"
                      value={annualReturn}
                      onChange={(e) => setAnnualReturn(Number(e.target.value))}
                      min={3}
                      max={12}
                      step={0.5}
                      className="w-full accent-[#C8A24B]"
                    />
                    <div className="flex justify-between ledger-key mt-1 !text-[10px]">
                      <span>3%</span>
                      <span className="text-[#E3C878] font-semibold">{annualReturn}%</span>
                      <span>12%</span>
                    </div>
                  </div>
                  <div className="p-3.5 bg-[#C8A24B]/[0.06] border border-[#C8A24B]/25">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="live-dot" />
                      <span className="ledger-key !text-[#C8A24B]">Live gold price</span>
                    </div>
                    <p className="ledger-val text-xl font-semibold">${formatNumber(goldSpotPrice)} / oz</p>
                    {investmentAmount > 0 && (
                      <p className="ledger-key mt-1">Your ${formatNumber(investmentAmount)} buys ~{calculateOunces()} oz</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side - Results */}
              <div className="space-y-4">
                <div className="bg-[#0D0B07] border border-[#2A2114] p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-[#2A2114] mb-5">
                    <h3 className="ledger-key !text-[#C8A24B]">Projected returns</h3>
                    <span className="ledger-key">{years}Y horizon</span>
                  </div>
                  <div className="space-y-4">
                    <div className="text-center p-4 border border-[#2A2114] bg-[#161109]">
                      <p className="ledger-key mb-1.5">Projected value</p>
                      <p className="ledger-val text-3xl font-semibold gold-gradient-text">${formatNumber(projectedValue)}</p>
                      <p className="ledger-val text-xs text-[#5F8B6E] mt-1.5">+${formatNumber(projectedValue - investmentAmount)} profit</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 border border-[#2A2114] bg-[#161109]">
                        <p className="ledger-key mb-1.5">Total return</p>
                        <p className="ledger-val text-lg font-semibold">{totalReturn}%</p>
                      </div>
                      <div className="text-center p-3 border border-[#2A2114] bg-[#161109]">
                        <p className="ledger-key mb-1.5">Gold (oz)</p>
                        <p className="ledger-val text-lg font-semibold">{calculateOunces()}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#0D0B07] border border-[#2A2114] p-5">
                  <h4 className="ledger-key !text-[#C8A24B] mb-4">Compare with</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between ledger-val text-xs mb-1.5">
                        <span className="text-[#EFE7D8]">Gold</span>
                        <span className="text-[#E3C878] font-semibold">${formatNumber(projectedValue)}</span>
                      </div>
                      <div className="w-full bg-[#241C10] h-1">
                        <div className="gold-gradient h-1 transition-all duration-500" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between ledger-val text-xs mb-1.5">
                        <span className="text-[#EFE7D8]">S&P 500 (~10%)</span>
                        <span className="text-[#EFE7D8] font-semibold">${formatNumber(sp500Value)}</span>
                      </div>
                      <div className="w-full bg-[#241C10] h-1">
                        <div className="bg-[#5F8B6E] h-1 transition-all duration-500" style={{ width: `${Math.min((sp500Value / projectedValue) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between ledger-val text-xs mb-1.5">
                        <span className="text-[#EFE7D8]">Savings account (~4%)</span>
                        <span className="text-[#EFE7D8] font-semibold">${formatNumber(savingsValue)}</span>
                      </div>
                      <div className="w-full bg-[#241C10] h-1">
                        <div className="bg-[#8C8272] h-1 transition-all duration-500" style={{ width: `${Math.min((savingsValue / projectedValue) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setAuthMode('register'); setAuthModalOpen(true); }} className="w-full btn-gold">
                  Start investing
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
