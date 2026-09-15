'use client';

import React, { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const faqItems = [
  { q: 'What is APEXSTORAGE?', a: 'APEXSTORAGE is an institutional-grade gold vaulting and custody service that provides secure storage, purchasing, and delivery of physical gold across our global network of LBMA-approved vaults.' },
  { q: 'How is my gold stored?', a: 'Your gold is stored in allocated or pooled storage at one of our secure vaults in Zurich, Singapore, London, or New York. Each bar is individually tracked with serial numbers and certificates of authenticity.' },
  { q: 'Is my gold insured?', a: 'Yes. All gold stored with APEXSTORAGE is fully insured by Lloyd\'s of London, covering both transit and storage. Your assets are protected against theft, damage, and other risks.' },
  { q: 'How do I buy gold?', a: 'You can purchase gold directly through our platform. We offer gold bars and coins from LBMA Good Delivery refiners at competitive premiums. Simply open a vault, choose your product, and place your order.' },
  { q: 'Can I take physical delivery?', a: 'Yes. You can request physical delivery of your gold at any time through our insured shipment service. We offer worldwide armored delivery with real-time GPS tracking.' },
  { q: 'What are the storage fees?', a: 'Storage fees are calculated at 0.02% per 100g per month for allocated storage, and 0.08% per 100g for pooled storage. Fees are charged monthly and include full insurance coverage.' },
  { q: 'How do I verify my holdings?', a: 'You can view your holdings in real-time through our live dashboard. We also provide quarterly audit reports from independent third-party auditors confirming the weight and purity of your assets.' },
  { q: 'What is the minimum investment?', a: 'The minimum initial purchase is 1 gram of gold. There is no maximum limit. We cater to both retail and institutional investors.' },
  { q: 'How secure are the vaults?', a: 'Our vaults meet LBMA standards and feature multi-layer security including biometric access, 24/7 surveillance, armed guards, seismic detection, and fire suppression systems.' },
  { q: 'Can I sell my gold back?', a: 'Yes. You can sell your gold back to APEXSTORAGE at the current spot price minus a small buyback spread. Settlement is typically within 2 business days.' },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Support</span>
            <h1 className="text-3xl sm:text-4xl font-bold mt-2 mb-4 tracking-tight text-[#F5F5F5]">
              Frequently Asked <span className="gold-gradient-text">Questions</span>
            </h1>
          </div>
          <div className="space-y-2">
            {faqItems.map((item, index) => (
              <div key={index} className="bg-[#10141d] border border-[#1c222e] rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1b212c]/30 transition-colors"
                >
                  <span className="text-sm font-medium text-[#F5F5F5] pr-4">{item.q}</span>
                  <svg
                    className={`w-4 h-4 text-[#C9A84C] shrink-0 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-[#8A8A8E] leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
