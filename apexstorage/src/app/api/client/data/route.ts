import { NextRequest, NextResponse } from 'next/server';
import { readRTDB } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const idToken = searchParams.get('token') || undefined;

    if (!userId && !userEmail) {
      return NextResponse.json({ error: 'userId or userEmail required' }, { status: 400 });
    }

    // Helper: match if record belongs to this user
    const belongsToUser = (record: any) =>
      record.userId === userId || record.userEmail === userEmail ||
      record.owner === userEmail;

    // Fetch all data in parallel for speed
    const [assetsData, ordersData, shipmentsData, vaultData] = await Promise.all([
      readRTDB('assets', idToken),
      readRTDB('orders', idToken),
      readRTDB('shipments', idToken),
      readRTDB('vaultRequests', idToken),
    ]);

    const assets = assetsData
      ? Object.values(assetsData).filter(belongsToUser).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      : [];

    const orders = ordersData
      ? Object.values(ordersData).filter(belongsToUser).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      : [];

    const shipments = shipmentsData
      ? Object.values(shipmentsData).filter(belongsToUser).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      : [];

    const vaultRequests = vaultData
      ? Object.values(vaultData).filter(belongsToUser).sort((a: any, b: any) => {
          const dateCompare = (b.date || '').localeCompare(a.date || '');
          if (dateCompare !== 0) return dateCompare;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        })
      : [];

    return NextResponse.json({ assets, orders, shipments, vaultRequests });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message || 'Unknown error',
      code: err.code || 'unknown',
    }, { status: 500 });
  }
}
