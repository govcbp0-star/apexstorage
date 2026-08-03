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
  const chartInstanceRef = useRef<ReturnType<typeof import('chart.js').Chart> | null>(null);

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
      gradient.addColorStop(0, 'rgba(201, 168, 76, 0.3)');
      gradient.addColorStop(1, 'rgba(201, 168, 76, 0)');

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: priceLabels.length > 0 ? priceLabels : priceHistory.map((_, i) => `${i + 1}`),
          datasets: [{
            data: priceHistory,
            borderColor: '#C9A84C',
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#C9A84C',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#10141d',
              borderColor: '#1c222e',
              borderWidth: 1,
              titleColor: '#F5F5F5',
              bodyColor: '#C9A84C',
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
              ticks: { color: '#8A8A8E', font: { size: 9 }, maxTicksLimit: 6 },
              grid: { color: 'rgba(28, 34, 46, 0.2)' },
              border: { color: '#1c222e' },
            },
            y: {
              display: true,
              min: priceHistory.length > 0 ? Math.floor(Math.min(...priceHistory) * 0.995) : undefined,
              max: priceHistory.length > 0 ? Math.ceil(Math.max(...priceHistory) * 1.005) : undefined,
              ticks: {
                color: '#8A8A8E',
                font: { size: 9 },
                callback: (val: string | number) => `$${Number(val).toLocaleString()}`,
              },
              grid: { color: 'rgba(28, 34, 46, 0.2)' },
              border: { color: '#1c222e' },
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
    <div className="bg-[#0b0e14] min-h-screen">
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
        <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
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
            <div className="absolute inset-0 bg-gradient-to-r from-[#111114]/80 via-[#111114]/60 to-[#111114]/80" />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#C9A84C]/5 to-transparent" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#C9A84C]/3 rounded-full blur-[120px]" />
            <div className="absolute top-20 right-20 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-[80px] animate-pulse" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="animate-[slideUp_0.6s_ease-out]">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#C9A84C]/20 bg-[#C9A84C]/5 rounded-full mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
                  <span className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase">Premier Gold Storage</span>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[0.95] mb-4 sm:mb-5 tracking-tight">
                  <span className="block text-[#F5F5F5]">SECURE YOUR</span>
                  <span className="block text-[#F5F5F5]">FUTURE WITH</span>
                  <span className="block gold-gradient-text text-glow">GOLD</span>
                </h1>
                <p className="text-base text-[#F5F5F5] max-w-md mb-8 leading-relaxed">
                  High-level security. Fully insured custody. Trusted by 100,000+ clients worldwide. Your asset is our priority.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setGetVaultModalOpen(true)} className="btn-gold">
                    Get Vault
                    <svg className="inline-block ml-1.5 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m0-4H3" />
                    </svg>
                  </button>
                  <button onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }} className="btn-gold-outline text-center">
                    Sign In
                  </button>
                </div>
                <div className="mt-8 sm:mt-12 flex gap-6 sm:gap-8">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-[#F5F5F5]">${stats.assets}B</div>
                    <div className="text-[8px] sm:text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mt-0.5">Assets Stored</div>
                  </div>
                  <div className="w-px bg-[#1b212c]" />
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-[#F5F5F5]">{stats.clients}K+</div>
                    <div className="text-[8px] sm:text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mt-0.5">Clients</div>
                  </div>
                  <div className="w-px bg-[#1b212c]" />
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-[#F5F5F5]">{stats.uptime}%</div>
                    <div className="text-[8px] sm:text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mt-0.5">Uptime</div>
                  </div>
                </div>
              </div>
              <div className="hidden lg:flex justify-center items-center animate-[fadeIn_0.8s_ease-out]">
                {/* Right side placeholder - as per original */}
              </div>
            </div>
          </div>
        </section>

        {/* VAULT SERVICES */}
        <section id="services" className="py-12 sm:py-16 md:py-20 bg-[#0b0e14] border-t border-[#1c222e]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">What We Offer</span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-4 tracking-tight">Our Vault <span className="gold-gradient-text">Services</span></h2>
              <p className="text-[#8A8A8E] text-sm leading-relaxed">Complete end-to-end gold custody platform trusted by investors across 40+ countries.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-12">
              {[
                { icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085', title: 'Secure Storage', desc: 'LBMA-approved vaults with full insurance. Individual bar tracking & serial numbers.' },
                { icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z', title: 'Gold Purchasing', desc: 'Buy bars & coins at competitive premiums. LBMA Good Delivery refiners only.' },
                { icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12', title: 'Insured Delivery', desc: 'Worldwide armored delivery with real-time GPS tracking and full insurance.' },
                { icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', title: 'Live Dashboard', desc: 'View live valuations, transaction history, and vault locations in real-time.' },
                { icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z', title: 'Full Insurance', desc: "Lloyd's of London underwritten coverage for transit and storage." },
                { icon: 'M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12', title: 'Audit Reports', desc: 'Quarterly third-party audits with certificates of authenticity and weight.' },
              ].map((service) => (
                <div key={service.title} className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 sm:p-5 hover:border-[#C9A84C]/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center mb-4 group-hover:bg-[#C9A84C]/20 transition-colors">
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={service.icon} />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-2">{service.title}</h3>
                  <p className="text-[#8A8A8E] text-xs leading-relaxed">{service.desc}</p>
                </div>
              ))}
            </div>

            {/* How It Works */}
            <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 sm:p-5 mb-12">
              <h3 className="text-sm font-bold tracking-[0.2em] text-[#F5F5F5] uppercase text-center mb-4 sm:mb-6">How It Works</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { num: '1', title: 'Register', desc: 'Create account & complete KYC' },
                  { num: '2', title: 'Buy or Request', desc: 'Purchase gold or request vault' },
                  { num: '3', title: 'Store', desc: 'Allocated in your chosen vault' },
                  { num: '4', title: 'Ship or Hold', desc: 'Delivery or long-term storage' },
                ].map((step) => (
                  <div key={step.num} className="text-center">
                    <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center mx-auto mb-2">
                      <span className="text-sm font-bold text-[#1A1A1E]">{step.num}</span>
                    </div>
                    <h4 className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wide mb-1">{step.title}</h4>
                    <p className="text-[10px] text-[#8A8A8E]">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vault Network */}
            <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 sm:p-5 mb-12">
              <h3 className="text-sm font-bold tracking-[0.2em] text-[#F5F5F5] uppercase text-center mb-4 sm:mb-5">Global Vault Network</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'Zurich', image: 'zurich.png', capacity: '150,000kg capacity' },
                  { name: 'Singapore', image: 'singapore.png', capacity: '300,000kg capacity' },
                  { name: 'London', image: 'london.jpg', capacity: '400,000kg capacity' },
                  { name: 'New York', image: 'new-york.png', capacity: '350,000kg capacity' },
                ].map((vault) => (
                  <div key={vault.name} className="text-center p-4 bg-[#0b0e14] rounded-lg border border-[#1c222e]">
                    <div className="mb-2">
                      <img src={`/images/${vault.image}`} alt={vault.name} className="w-8 h-6 mx-auto rounded-sm object-cover" />
                    </div>
                    <h4 className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wide">{vault.name}</h4>
                    <p className="text-[10px] text-[#8A8A8E]">{vault.capacity}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <div className="bg-[#10141d] border border-[#C9A84C]/30 rounded-lg p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-[#F5F5F5] mb-3 tracking-tight">Need More Information?</h3>
                <p className="text-[#8A8A8E] text-xs sm:text-sm mb-5 sm:mb-6 max-w-md mx-auto">Our team is ready to answer your questions about vault storage, pricing, or custom solutions.</p>
                <a href="/contact" className="btn-gold text-sm px-8 py-3 inline-flex items-center justify-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Make Enquiry
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Gold Bars Section */}
        <section id="gold" className="py-12 sm:py-16 md:py-20 bg-[#10141d]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Our Products</span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mt-2 mb-3 tracking-tight">Invest in <span className="gold-gradient-text">Physical Gold</span></h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
              {[
                {
                  renderIcon: () => (
                    <svg className="w-10 h-10 text-[#C9A84C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {/* Top layer (diamond) */}
                      <path d="M12 3L2 8L12 13L22 8Z" />
                      {/* Middle layer (chevron) */}
                      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
                      {/* Bottom layer (chevron) */}
                      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
                    </svg>
                  ),
                  title: 'Gold Bars',
                  desc: '1g to 1kg \u2022 LBMA certified',
                },
                {
                  renderIcon: () => (
                    <svg className="w-10 h-10 text-[#C9A84C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {/* Right Stack (Behind) */}
                      {/* Bottom Coin */}
                      <path d="M11 17.5a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#10141d" />
                      <ellipse cx="15" cy="17.5" rx="4" ry="1.8" fill="#10141d" />
                      
                      {/* Middle Coin */}
                      <path d="M11 14a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#10141d" />
                      <ellipse cx="15" cy="14" rx="4" ry="1.8" fill="#10141d" />
                      
                      {/* Top Coin */}
                      <path d="M11 10.5a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#10141d" />
                      <ellipse cx="15" cy="10.5" rx="4" ry="1.8" fill="#10141d" />

                      {/* Left Stack (In Front - covers right stack) */}
                      {/* Bottom Coin */}
                      <path d="M5 14a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#10141d" />
                      <ellipse cx="9" cy="14" rx="4" ry="1.8" fill="#10141d" />
                      
                      {/* Top Coin */}
                      <path d="M5 10.5a4 1.8 0 0 0 8 0v1.5a4 1.8 0 0 1-8 0z" fill="#10141d" />
                      <ellipse cx="9" cy="10.5" rx="4" ry="1.8" fill="#10141d" />
                    </svg>
                  ),
                  title: 'Gold Coins',
                  desc: 'Krugerrand, Maple Leaf',
                },
                {
                  renderIcon: () => (
                    <svg className="w-10 h-10 text-[#C9A84C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                  desc: '4 global locations',
                },
              ].map((product) => (
                <div key={product.title} className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6 hover:border-[#C9A84C]/30 transition-all duration-300 group">
                  <div className="w-16 h-10 mx-auto mb-4 flex items-center justify-center">
                    {product.renderIcon()}
                  </div>
                  <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] uppercase text-center mb-1">{product.title}</h3>
                  <p className="text-center text-[#8A8A8E] text-xs">{product.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Invest Section */}
        <section id="invest" className="py-12 sm:py-16 md:py-20 bg-[#0b0e14]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 items-center">
              <div>
                <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Why Gold</span>
                <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-4 tracking-tight">The Ultimate <span className="gold-gradient-text">Wealth Hedge</span></h2>
                <p className="text-[#8A8A8E] text-sm mb-6">Gold has preserved wealth for 5,000+ years. The anchor of a resilient portfolio.</p>
                <div className="space-y-4">
                  {[
                    { title: 'Inflation Protection', desc: 'Outpaces inflation over long periods' },
                    { title: 'Diversification', desc: 'Low correlation with stocks & bonds' },
                    { title: 'Global Liquidity', desc: 'Tradeable 24/7 worldwide' },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded gold-gradient flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#1A1A1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#F5F5F5]">{item.title}</h4>
                        <p className="text-[#8A8A8E] text-xs mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase flex items-center gap-1.5">
                        <span className="live-dot" /> LIVE
                      </p>
                      <p className="text-2xl font-bold text-[#F5F5F5] mt-0.5">${formatNumber(goldSpotPrice)} / oz</p>
                      <p className="text-[10px] text-[#8A8A8E] mt-0.5">{goldPriceUpdated ? `Updated ${goldPriceUpdated}` : 'Loading...'}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-bold ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {priceChange >= 0 ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m0 0v11" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                      )}
                      <span>{Math.abs(priceChangePercent).toFixed(2)}%</span>
                    </div>
                  </div>
                   <div className="h-44 mb-2">
                    <canvas ref={goldChartRef} className="w-full h-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROI Calculator Section */}
        <section id="security" className="py-12 sm:py-16 md:py-20 bg-[#10141d] border-t border-b border-[#1c222e]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Investment Tool</span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mt-2 tracking-tight">Gold Investment <span className="gold-gradient-text">Calculator</span></h2>
              <p className="text-[#8A8A8E] text-xs sm:text-sm mt-3 max-w-lg mx-auto">See how your investment could grow with real gold prices. Historical gold has averaged ~7.5% annual return.</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 items-start">
              {/* Left Side - Inputs */}
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-5 sm:p-6">
                <h3 className="text-sm font-bold text-[#C9A84C] tracking-wide uppercase mb-5">Investment Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1.5">Investment Amount (USD)</label>
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
                    <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1.5">Time Period</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 3, 5, 10].map((y) => (
                        <button
                          key={y}
                          onClick={() => setYears(y)}
                          className={`py-2 rounded text-[10px] font-bold tracking-wide uppercase transition-all ${years === y ? 'gold-gradient text-[#1A1A1E]' : 'border border-[#1c222e] text-[#F5F5F5]'}`}
                        >
                          {y}Y
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1.5">Expected Annual Return</label>
                    <input
                      type="range"
                      value={annualReturn}
                      onChange={(e) => setAnnualReturn(Number(e.target.value))}
                      min={3}
                      max={12}
                      step={0.5}
                      className="w-full accent-[#C9A84C]"
                    />
                    <div className="flex justify-between text-[10px] text-[#8A8A8E] mt-1">
                      <span>3%</span>
                      <span className="text-[#C9A84C] font-bold">{annualReturn}%</span>
                      <span>12%</span>
                    </div>
                  </div>
                  <div className="p-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] text-[#C9A84C] font-bold tracking-wide uppercase">LIVE GOLD PRICE</span>
                    </div>
                    <p className="text-xl font-bold text-[#F5F5F5]">${formatNumber(goldSpotPrice)} / oz</p>
                    {investmentAmount > 0 && (
                      <p className="text-[10px] text-[#8A8A8E] mt-0.5">Your ${formatNumber(investmentAmount)} buys ~{calculateOunces()} oz</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side - Results */}
              <div className="space-y-4">
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
                  <h3 className="text-sm font-bold text-[#C9A84C] tracking-wide uppercase mb-4">Projected Returns</h3>
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-[#1b212c]/30 rounded">
                      <p className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mb-1">Projected Value</p>
                      <p className="text-3xl font-bold gold-gradient-text">${formatNumber(projectedValue)}</p>
                      <p className="text-xs text-green-500 mt-1">+${formatNumber(projectedValue - investmentAmount)} profit</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-[#1b212c]/30 rounded">
                        <p className="text-[9px] text-[#8A8A8E] tracking-wide uppercase">Total Return</p>
                        <p className="text-lg font-bold text-[#F5F5F5]">{totalReturn}%</p>
                      </div>
                      <div className="text-center p-3 bg-[#1b212c]/30 rounded">
                        <p className="text-[9px] text-[#8A8A8E] tracking-wide uppercase">Gold (oz)</p>
                        <p className="text-lg font-bold text-[#F5F5F5]">{calculateOunces()}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-5">
                  <h4 className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase mb-3">Comparison</h4>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#F5F5F5]">Gold</span>
                        <span className="text-[#C9A84C] font-bold">${formatNumber(projectedValue)}</span>
                      </div>
                      <div className="w-full bg-[#1b212c] rounded h-1.5">
                        <div className="gold-gradient h-1.5 rounded transition-all duration-500" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#F5F5F5]">S&P 500 (~10%)</span>
                        <span className="text-[#F5F5F5] font-bold">${formatNumber(sp500Value)}</span>
                      </div>
                      <div className="w-full bg-[#1b212c] rounded h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded transition-all duration-500" style={{ width: `${Math.min((sp500Value / projectedValue) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#F5F5F5]">Savings Account (~4%)</span>
                        <span className="text-[#F5F5F5] font-bold">${formatNumber(savingsValue)}</span>
                      </div>
                      <div className="w-full bg-[#1b212c] rounded h-1.5">
                        <div className="bg-[#8A8A8E] h-1.5 rounded transition-all duration-500" style={{ width: `${Math.min((savingsValue / projectedValue) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setAuthMode('register'); setAuthModalOpen(true); }} className="w-full btn-gold text-sm">
                  Start Investing Now
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
