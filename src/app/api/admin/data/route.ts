import { NextRequest, NextResponse } from 'next/server';
import { readRTDB } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined;

    // Fetch all data in parallel
    const [usersData, vaultData, msgData, assetsData, ordersData, shipmentsData, newsletterData] = await Promise.all([
      readRTDB('users', idToken),
      readRTDB('vaultRequests', idToken),
      readRTDB('contactMessages', idToken),
      readRTDB('assets', idToken),
      readRTDB('orders', idToken),
      readRTDB('shipments', idToken),
      readRTDB('newsletter', idToken),
    ]);

    const users = usersData
      ? Object.entries(usersData).map(([uid, profile]: [string, any]) => ({
          id: uid,
          name: profile.name || '',
          email: profile.email || '',
          role: profile.role || 'client',
          status: profile.status || 'active',
          vaultLocation: profile.vaultLocation || '',
          joined: profile.createdAt ? new Date(profile.createdAt).toISOString().split('T')[0] : '',
          createdAt: profile.createdAt || '',
        })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      : [];

    const vaultRequests = vaultData
      ? Object.values(vaultData).sort((a: any, b: any) => {
          const dateCompare = (b.date || '').localeCompare(a.date || '');
          if (dateCompare !== 0) return dateCompare;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        })
      : [];

    const messages = msgData
      ? Object.values(msgData).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
      : [];

    const assets = assetsData
      ? Object.values(assetsData).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      : [];

    const orders = ordersData
      ? Object.values(ordersData).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      : [];

    const shipments = shipmentsData
      ? Object.values(shipmentsData).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      : [];

    const newsletterSubscribers = newsletterData
      ? Object.entries(newsletterData)
          .map(([id, subscriber]: [string, any]) => ({
            id,
            email: subscriber.email || '',
            subscribedAt: subscriber.subscribedAt || '',
            source: subscriber.source || 'website-footer',
          }))
          .filter((subscriber) => subscriber.email)
          .sort((a, b) => (b.subscribedAt || '').localeCompare(a.subscribedAt || ''))
      : [];

    return NextResponse.json({
      users,
      vaultRequests,
      messages,
      assets,
      orders,
      shipments,
      newsletterSubscribers,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message || 'Unknown error',
      code: err.code || 'unknown',
    }, { status: 500 });
  }
}
