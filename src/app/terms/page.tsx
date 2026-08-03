'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Legal</span>
            <h1 className="text-3xl sm:text-4xl font-bold mt-2 mb-4 tracking-tight text-[#F5F5F5]">
              Terms of <span className="gold-gradient-text">Service</span>
            </h1>
            <p className="text-xs text-[#8A8A8E]">Last updated: January 2024</p>
          </div>
          <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6 sm:p-8 space-y-6">
            {[
              { title: '1. Acceptance of Terms', content: 'By accessing or using APEXSTORAGE services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.' },
              { title: '2. Service Description', content: 'APEXSTORAGE provides institutional-grade gold vaulting, purchasing, and delivery services. We act as a custodian for your physical gold assets stored in our secure vaults.' },
              { title: '3. Account Registration', content: 'You must provide accurate and complete information when registering. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.' },
              { title: '4. Gold Transactions', content: 'All gold purchases are final once confirmed. Prices are based on the live spot price at the time of transaction. APEXSTORAGE reserves the right to refuse any transaction.' },
              { title: '5. Storage and Insurance', content: 'Gold stored in our vaults is fully insured by Lloyd\'s of London. Storage fees are charged monthly based on the weight and type of storage. Fee changes require 30 days notice.' },
              { title: '6. Delivery and Shipment', content: 'Physical delivery requests are subject to availability and applicable regulations. Delivery times vary by destination. All shipments are insured during transit. The customer is responsible for any applicable customs duties or taxes.' },
              { title: '7. Liability Limitations', content: 'APEXSTORAGE\'s total liability shall not exceed the market value of the gold held in your account at the time of the claim. We are not liable for indirect, incidental, or consequential damages.' },
              { title: '8. Termination', content: 'Either party may terminate the storage agreement with 30 days written notice. Upon termination, you may request delivery of your gold or sell it back at the current spot price.' },
              { title: '9. Governing Law', content: 'These terms are governed by the laws of Switzerland. Any disputes shall be resolved through arbitration in Zurich, Switzerland.' },
              { title: '10. Contact', content: 'For questions about these terms, contact: APEXSTORAGE Legal, Bahnhofstrasse 42, 8001 Zurich, Switzerland, or email legal@apexstorage.com.' },
            ].map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-bold text-[#F5F5F5] mb-2">{section.title}</h2>
                <p className="text-xs text-[#8A8A8E] leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
