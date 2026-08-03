import { NextResponse } from 'next/server';
import { fetchGoldPrice } from '@/lib/gold-price';

export async function GET() {
  try {
    const data = await fetchGoldPrice();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { price: 4744.08, previousPrice: 4744.08, changePercent: 0, lastUpdated: '', priceHistory: [], labels: [] },
      { status: 200 }
    );
  }
}
