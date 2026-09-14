'use client';

import React, { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { sendMessage } from '@/lib/messages';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) { setError('Enter your name'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(form.email.trim())) { setError('Enter a valid email'); return; }
    if (form.subject.trim().length < 3) { setError('Enter a subject'); return; }
    if (form.message.trim().length < 10) { setError('Message must be at least 10 characters'); return; }

    setSending(true);
    try {
      await sendMessage({
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Contact form error:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Get in Touch</span>
            <h1 className="text-3xl sm:text-4xl font-bold mt-2 mb-4 tracking-tight text-[#F5F5F5]">
              Contact <span className="gold-gradient-text">Us</span>
            </h1>
            <p className="text-[#8A8A8E] text-sm max-w-lg mx-auto">Have questions about our vault services? Our team is ready to assist you.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
              <h2 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-4">Send a Message</h2>
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  {error && <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400">{error}</div>}
                  <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Name</label><input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="input-aurum" placeholder="Your name" required disabled={sending} /></div>
                  <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="input-aurum" placeholder="you@example.com" required disabled={sending} /></div>
                  <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Subject</label><input type="text" value={form.subject} onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))} className="input-aurum" placeholder="Subject" required disabled={sending} /></div>
                  <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Message</label><textarea value={form.message} onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))} className="input-aurum resize-none" rows={4} placeholder="Your message..." required disabled={sending} /></div>
                  <button type="submit" className="w-full btn-gold text-xs" disabled={sending}>
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-sm font-bold text-[#F5F5F5] mb-1">Message Sent!</h3>
                  <p className="text-xs text-[#8A8A8E]">We&apos;ll respond within 24 hours.</p>
                  <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }} className="btn-gold-outline text-xs mt-4">Send Another</button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
                <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Office</h3>
                <div className="space-y-2 text-xs text-[#8A8A8E]">
                  <p>Bahnhofstrasse 42</p>
                  <p>8001 Zurich, Switzerland</p>
                  <p className="text-[#C9A84C]">support@apexstorage.com</p>
                  <p>+41 44 000 0000</p>
                </div>
              </div>
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
                <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Hours</h3>
                <div className="space-y-2 text-xs text-[#8A8A8E]">
                  <p>Monday - Friday: 08:00 - 18:00 CET</p>
                  <p>Saturday: 09:00 - 13:00 CET</p>
                  <p>Sunday: Closed</p>
                </div>
              </div>
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-6">
                <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Emergency</h3>
                <p className="text-xs text-[#8A8A8E]">24/7 emergency line for vault access issues:</p>
                <p className="text-sm font-bold text-[#C9A84C] mt-1">+1 315-696-0218</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
