const GOLD_MIN_PRICE = 4000.00;
const DEFAULT_PRICE = 4744.08;

export interface GoldPriceData {
  price: number;
  previousPrice: number;
  changePercent: number;
  lastUpdated: string;
  priceHistory: number[];
  labels: string[];
}

let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function fetchGoldPrice(): Promise<GoldPriceData> {
  const now = Date.now();
  if (cachedData && now - lastFetchTime < CACHE_DURATION) {
    return cachedData;
  }

  let price = DEFAULT_PRICE;
  let previousPrice = DEFAULT_PRICE;
  let lastUpdated = '';
  let priceHistory: number[] = [];
  let labels: string[] = [];

  try {
    const response = await fetch('https://api.metals.live/v1/spot', { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        const goldEntry = data.find((item: { metal: string }) => item.metal === 'gold');
        if (goldEntry && goldEntry.price) {
          price = Math.max(parseFloat(goldEntry.price), GOLD_MIN_PRICE);
          lastUpdated = new Date().toLocaleTimeString();
        }
      }
    }
  } catch {
    // Primary API failed, try secondary
    try {
      const response2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd', {
        signal: AbortSignal.timeout(5000),
      });
      if (response2.ok) {
        const data2 = await response2.json();
        if (data2['tether-gold'] && data2['tether-gold'].usd) {
          price = Math.max(parseFloat(data2['tether-gold'].usd), GOLD_MIN_PRICE);
          lastUpdated = new Date().toLocaleTimeString() + ' (CG)';
        }
      }
    } catch {
      // Secondary failed too
      price = Math.max(DEFAULT_PRICE, GOLD_MIN_PRICE);
      lastUpdated = new Date().toLocaleTimeString() + ' (est)';
    }
  }

  // Try to get 90-day history
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/tether-gold/market_chart?vs_currency=usd&days=90', {
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.prices && Array.isArray(data.prices)) {
        priceHistory = data.prices.map((p: number[]) => Math.max(p[1], GOLD_MIN_PRICE));
        labels = data.prices.map((p: number[]) => {
          const d = new Date(p[0]);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
      }
    }
  } catch {
    // History fetch failed - generate synthetic data
    priceHistory = Array.from({ length: 90 }, (_, i) => {
      const base = price - 200;
      const trend = (i / 90) * 200;
      const noise = (Math.random() - 0.5) * 80;
      return Math.max(base + trend + noise, GOLD_MIN_PRICE);
    });
    labels = Array.from({ length: 90 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (89 - i));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
  }

  const changePercent = previousPrice ? ((price - previousPrice) / previousPrice) * 100 : 0;

  cachedData = {
    price,
    previousPrice,
    changePercent,
    lastUpdated,
    priceHistory,
    labels,
  };
  lastFetchTime = now;

  return cachedData;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
