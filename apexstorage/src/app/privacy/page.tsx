'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Legal</span>
            <h1 className="text-3xl sm:text-4xl font-bold mt-2 mb-4 tracking-tight text-[#F5F5F5]">
              Privacy <span className="gold-gradient-text">Policy</span>
            </h1>
            <p className="text-xs text-[#8A8A8E]">Last updated: January 2024</p>
          </div>
          <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6 sm:p-8 space-y-6">
            {[
              { title: '1. Information We Collect', content: 'We collect personal information that you provide when registering for an account, including your name, email address, phone number, and mailing address. We also collect information about your gold transactions, vault preferences, and communications with our support team.' },
              { title: '2. How We Use Your Information', content: 'We use your information to provide and improve our vault services, process transactions, communicate with you about your account, comply with regulatory requirements (including KYC/AML), and protect the security of your assets.' },
              { title: '3. Data Storage and Security', content: 'Your data is stored on encrypted servers with industry-standard security measures. We use 256-bit SSL encryption for data in transit and AES-256 encryption for data at rest. Access to personal data is strictly limited to authorized personnel.' },
              { title: '4. Third-Party Sharing', content: 'We do not sell your personal information. We may share data with insurance providers, regulatory authorities as required by law, and auditors for the purpose of verifying holdings. All third parties are bound by confidentiality agreements.' },
              { title: '5. Your Rights', content: 'You have the right to access, correct, or delete your personal data. You may also request data portability and restrict processing. To exercise these rights, contact our privacy team at privacy@apexstorage.com.' },
              { title: '6. Cookies', content: 'We use essential cookies for authentication and session management. Analytics cookies are used to improve our platform and can be disabled in your browser settings.' },
              { title: '7. Contact', content: 'For privacy-related inquiries, contact: APEXSTORAGE Privacy Team, Bahnhofstrasse 42, 8001 Zurich, Switzerland, or email privacy@apexstorage.com.' },
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
