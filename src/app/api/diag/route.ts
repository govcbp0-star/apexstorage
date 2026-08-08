import { NextResponse } from 'next/server';

// TEMPORARY diagnostic route — reports the Node version and which modules
// fail to import in Vercel's serverless runtime. Removed before finishing.
export async function GET() {
  const results: Record<string, string> = { node: process.version };
  const targets: Array<[string, string]> = [
    ['firebase-admin/app', 'firebase-admin/app'],
    ['firebase-admin/auth', 'firebase-admin/auth'],
    ['@react-email/render', '@react-email/render'],
    ['resend', 'resend'],
    ['@/lib/firebase-admin', '@/lib/firebase-admin'],
    ['@/lib/auth-email-service', '@/lib/auth-email-service'],
  ];
  for (const [name, spec] of targets) {
    try {
      await import(spec);
      results[name] = 'OK';
    } catch (e: any) {
      results[name] = `FAIL: ${(e?.message || String(e)).slice(0, 300)}`;
    }
  }
  results['typeof window'] = typeof window;
  results['typeof document'] = typeof document;
  return NextResponse.json(results);
}
