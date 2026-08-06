'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import GetVaultModal from '@/components/modals/GetVaultModal';
import BuyGoldModal from '@/components/modals/BuyGoldModal';
import ShipmentWizard from '@/components/modals/ShipmentWizard';
import ProfileSettings from '@/components/modals/ProfileSettings';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';
import { AssetRecord, subscribeToAssets } from '@/lib/assets-service';
import { Order, subscribeToOrders } from '@/lib/orders-service';
import { Shipment, subscribeToShipments } from '@/lib/shipments-service';
import { VaultRequest, subscribeToVaultRequests } from '@/lib/vault-requests';
import { Transaction, subscribeToTransactions } from '@/lib/transactions-service';
import TransactionHistory from '@/components/TransactionHistory';
import { formatNumber } from '@/lib/gold-price';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme-context';

// Dynamic imports for Chart.js components — avoid SSR canvas issues
const StorageFeesChart = dynamic(() => import('@/components/charts/StorageFeesChart'), { ssr: false });
const AllocationDonut = dynamic(() => import('@/components/charts/AllocationDonut'), { ssr: false });
const ReturnsBar = dynamic(() => import('@/components/charts/ReturnsBar'), { ssr: false });
const PerformanceChart = dynamic(() => import('@/components/modals/PerformanceChart'), { ssr: false });

// ─── Institutional design tokens ────────────────────────────────────
//.canvas     #0E1014   (app shell)
//.surface    #10141D   (card)
//.surface-2  #141A24   (elevated / table head)
//.hairline   #1C222E   (default border)
//.hairline-2 #212836   (stronger border)
//.muted      #8A8A8E
//.muted-2    #5A5A5E
//.ink        #F5F5F5
//.gold       #C9A84C
// ─────────────────────────────────────────────────────────────────────

// ── Toast ────────────────────────────────────────────────────────────
function Toast({ message, type, visible }: { message: string; type: string; visible: boolean }) {
  if (!visible) return null;
  const tones: Record<string, string> = {
    success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    error: 'border-red-500/25 bg-red-500/10 text-red-400',
    info: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
  };
  const dot: Record<string, string> = {
    success: 'bg-emerald-400',
    error: 'bg-red-400',
    info: 'bg-sky-400',
  };
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-4 py-2.5 border rounded-md shadow-2xl backdrop-blur-md text-xs font-medium tracking-wide animate-[fadeIn_0.2s_ease-out]',
      tones[type] || tones.info,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', dot[type] || dot.info)} />
      {message}
    </div>
  );
}

// ── Status chip (dot + uppercase) ────────────────────────────────────
const STATUS_MAP: Record<string, { dot: string; chip: string }> = {
  active: { dot: 'bg-emerald-400', chip: 'text-emerald-400' },
  added: { dot: 'bg-emerald-400', chip: 'text-emerald-400' },
  pending: { dot: 'bg-amber-400', chip: 'text-amber-400' },
  processing: { dot: 'bg-sky-400', chip: 'text-sky-400' },
  completed: { dot: 'bg-emerald-400', chip: 'text-emerald-400' },
  cancelled: { dot: 'bg-red-400', chip: 'text-red-400' },
  approved: { dot: 'bg-emerald-400', chip: 'text-emerald-400' },
  rejected: { dot: 'bg-red-400', chip: 'text-red-400' },
  shipped: { dot: 'bg-sky-400', chip: 'text-sky-400' },
};

// ── Vault location metadata (grouped by country) ─────────────────────
// Canonical keys: zurich | singapore | london | newyork
const VAULT_LOCATION_META: Record<string, { label: string; country: string }> = {
  zurich: { label: 'Zurich', country: 'Switzerland' },
  singapore: { label: 'Singapore', country: 'Singapore' },
  london: { label: 'London', country: 'United Kingdom' },
  newyork: { label: 'New York', country: 'United States' },
};

// Groups for the location dropdown (city → country)
const VAULT_LOCATION_GROUPS = [
  { country: 'Switzerland', cities: [{ value: 'zurich', label: 'Zurich' }] },
  { country: 'Singapore', cities: [{ value: 'singapore', label: 'Singapore' }] },
  { country: 'United Kingdom', cities: [{ value: 'london', label: 'London' }] },
  { country: 'United States', cities: [{ value: 'newyork', label: 'New York' }] },
];

/** Normalize any stored location string to a canonical vault key. */
function locKey(loc: string): string {
  const l = (loc || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (l.includes('zurich')) return 'zurich';
  if (l.includes('singapore')) return 'singapore';
  if (l.includes('london')) return 'london';
  if (l.includes('newyork')) return 'newyork';
  return l;
}

/** Reusable vault-location dropdown used in the Vault Information card and the Dashboard KPI card. */
function VaultLocationSelect({
  value,
  onChange,
  ownedKeys,
}: {
  value: string;
  onChange: (v: string) => void;
  ownedKeys: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={ownedKeys.length === 0}
        className="input-aurum appearance-none pr-7 py-1 text-[11px] min-w-0 max-w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Filter vault location"
      >
        {ownedKeys.length === 0 && <option value="">No vaults</option>}
        {VAULT_LOCATION_GROUPS.map((group) => {
          const owned = group.cities.filter((c) => ownedKeys.includes(c.value));
          if (owned.length === 0) return null;
          return (
            <optgroup key={group.country} label={group.country}>
              {owned.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8A8A8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { dot: 'bg-[#C9A84C]', chip: 'text-[#C9A84C]' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[9px] font-bold tracking-[0.12em] uppercase bg-white/[0.02] border border-white/5', s.chip)}>
      <span className={cn('w-1 h-1 rounded-full', s.dot)} />
      {status}
    </span>
  );
}

type NotificationKind = 'purchase' | 'shipment' | 'vault' | 'payment' | 'asset';

interface ClientNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  timestamp: string;
  nav?: string;
}

function notificationTime(...values: Array<string | undefined>): string {
  return values.find((value) => value && !Number.isNaN(new Date(value).getTime())) || new Date(0).toISOString();
}

function buildClientNotifications({
  assets,
  orders,
  shipments,
  vaultRequests,
  transactions,
}: {
  assets: AssetRecord[];
  orders: Order[];
  shipments: Shipment[];
  vaultRequests: VaultRequest[];
  transactions: Transaction[];
}): ClientNotification[] {
  const notifications: ClientNotification[] = [];
  const add = (notification: ClientNotification) => notifications.push(notification);

  orders.forEach((order) => {
    const status = (order.status || 'pending').toLowerCase();
    const title = status === 'completed'
      ? 'Gold purchase confirmed'
      : status === 'cancelled'
        ? 'Gold purchase cancelled'
        : `Gold purchase ${status}`;
    add({
      id: `order-${order.id}`,
      kind: 'purchase',
      title,
      description: `${order.quantityGrams || 0}g ${order.productType || 'gold'} order · ${order.vault || 'Vault allocation'}`,
      timestamp: notificationTime(order.createdAt, order.date),
      nav: 'orders',
    });
  });

  shipments.forEach((shipment) => {
    const status = (shipment.status || 'pending').toLowerCase();
    const title = status === 'delivered' || status === 'completed'
      ? 'Shipment delivered'
      : `Shipment ${status}`;
    add({
      id: `shipment-${shipment.id}`,
      kind: 'shipment',
      title,
      description: `${shipment.weight || 0}g · ${shipment.deliveryCity || shipment.deliveryCountry || 'Delivery request'}`,
      timestamp: notificationTime(shipment.createdAt, shipment.date),
      nav: 'shipments',
    });
  });

  vaultRequests.forEach((request) => {
    const status = (request.status || 'pending').toLowerCase();
    add({
      id: `vault-${request.id}`,
      kind: 'vault',
      title: `Vault request ${status}`,
      description: `${request.quantity || 0}g · ${request.location || 'Vault location'}`,
      timestamp: notificationTime(request.createdAt, request.date),
      nav: 'vault',
    });
  });

  transactions.forEach((transaction) => {
    const status = (transaction.paymentStatus || 'pending').toLowerCase();
    const isPurchase = transaction.type === 'gold_purchase';
    const subject = isPurchase ? 'Gold purchase' : 'Shipment payment';
    add({
      id: `transaction-${transaction.id}`,
      kind: 'payment',
      title: `${subject} ${status}`,
      description: `$${(transaction.amount || 0).toLocaleString()} · ${transaction.description || 'Payment activity'}`,
      timestamp: notificationTime(transaction.updatedAt, transaction.createdAt),
      nav: 'transactions',
    });
  });

  assets.forEach((asset) => {
    add({
      id: `asset-${asset.id}`,
      kind: 'asset',
      title: 'Gold added to holdings',
      description: `${asset.weight || 0}g ${asset.type || 'gold'} · ${asset.vaultLocation || 'Vault storage'}`,
      timestamp: notificationTime(asset.createdAt),
      nav: 'holdings',
    });
  });

  return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function NotificationGlyph({ kind }: { kind: NotificationKind }) {
  const paths: Record<NotificationKind, string> = {
    purchase: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    shipment: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    vault: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1',
    payment: 'M3 10h18M7 15h.01M11 15h2m-8 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    asset: 'M12 3v18m9-9H3m15.5-6.5L5.5 18.5m13 0L5.5 5.5',
  };

  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d={paths[kind]} />
    </svg>
  );
}

// ── Small presentational primitives ──────────────────────────────────
function SectionLabel({children, className}: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('text-[10px] font-bold tracking-[0.22em] text-[#C9A84C] uppercase', className)}>
      {children}
    </span>
  );
}

function CardHeader({ title, caption, action }: { title: string; caption?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-4">
      <div className="min-w-0">
        <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#F5F5F5] uppercase">{title}</h3>
        {caption && <p className="text-[10px] text-[#5A5A5E] mt-1 tracking-wide">{caption}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn(
      'relative bg-[#10141D] border rounded-lg p-4 overflow-hidden',
      accent ? 'border-[#C9A84C]/25' : 'border-[#1c222e]',
    )}>
      {accent && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent" />}
      <p className="text-[9px] font-bold tracking-[0.2em] text-[#5A5A5E] uppercase">{label}</p>
      <div className="mt-2 text-2xl font-bold text-[#F5F5F5] tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[10px] text-[#8A8A8E]">{sub}</div>}
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="py-12 flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-lg border border-[#1c222e] bg-[#0E1014] flex items-center justify-center mb-3 text-[#3A3A3E]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[#F5F5F5] tracking-tight">{title}</p>
      <p className="text-[11px] text-[#5A5A5E] mt-1 mb-4 max-w-xs">{desc}</p>
      {action}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function ClientDashboard() {
  const { authRole, userProfile, user, loading: authLoading, pending2FA, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [transitionLoading, setTransitionLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTransitionLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Navigation state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');

  // Gold price state
  const [goldSpotPrice, setGoldSpotPrice] = useState(4744.08);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [goldPriceUpdated, setGoldPriceUpdated] = useState('');
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [priceLabels, setPriceLabels] = useState<string[]>([]);
  const [dashboardClock, setDashboardClock] = useState('');

  // RTDB data state
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [myVaultRequests, setMyVaultRequests] = useState<VaultRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modal state
  const [getVaultOpen, setGetVaultOpen] = useState(false);
  const [buyGoldOpen, setBuyGoldOpen] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>([]);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Selected vault location (used by Vault page + Dashboard KPI card)
  const [selectedVaultKey, setSelectedVaultKey] = useState<string>('');

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!user?.uid) {
        setReadNotificationIds([]);
        setDeletedNotificationIds([]);
        return;
      }

      try {
        const storedRead = localStorage.getItem(`client_notification_read_${user.uid}`);
        const parsedRead = storedRead ? JSON.parse(storedRead) : [];
        setReadNotificationIds(Array.isArray(parsedRead) ? parsedRead : []);

        const storedDeleted = localStorage.getItem(`client_notification_deleted_${user.uid}`);
        const parsedDeleted = storedDeleted ? JSON.parse(storedDeleted) : [];
        setDeletedNotificationIds(Array.isArray(parsedDeleted) ? parsedDeleted : []);
      } catch {
        setReadNotificationIds([]);
        setDeletedNotificationIds([]);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user?.uid]);

  useEffect(() => {
    if (!notificationOpen && !profileMenuOpen) return;

    const closeMenus = (event: MouseEvent) => {
      if (!headerMenuRef.current?.contains(event.target as Node)) {
        setNotificationOpen(false);
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, [notificationOpen, profileMenuOpen]);

  // Auth check
  useEffect(() => {
    if (!authLoading) {
      if (pending2FA) {
        router.push('/auth/login');
      } else if (authRole === 'guest') {
        router.push('/');
      }
    }
  }, [authRole, authLoading, pending2FA, router]);

  // ── Data loading strategy ──
  // Primary: API route (uses Admin SDK to bypass RTDB security rules)
  // Secondary: RTDB real-time subscriptions (only work if client has auth context)

  useEffect(() => {
    if (!user?.uid || authLoading) return;
    let mounted = true;
    const unsubscribe = subscribeToAssets((allAssets) => {
      if (!mounted) return;
      const filtered = allAssets.filter(a => a.userId === user.uid || a.owner === user.email);
      if (filtered.length > 0) setAssets(filtered);
    }, (error) => {
      console.warn('[Client] RTDB assets subscription error:', error.code);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [user, authLoading]);

  useEffect(() => {
    if (!user?.uid || authLoading) return;
    let mounted = true;
    const unsubscribe = subscribeToOrders((allOrders) => {
      if (!mounted) return;
      const filtered = allOrders.filter(o => o.userId === user.uid || o.userEmail === user.email);
      if (filtered.length > 0) setOrders(filtered);
    }, (error) => {
      console.warn('[Client] RTDB orders subscription error:', error.code);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [user, authLoading]);

  useEffect(() => {
    if (!user?.uid || authLoading) return;
    let mounted = true;
    const unsubscribe = subscribeToShipments((allShipments) => {
      if (!mounted) return;
      const filtered = allShipments.filter(s => s.userId === user.uid || s.userEmail === user.email);
      if (filtered.length > 0) setShipments(filtered);
    }, (error) => {
      console.warn('[Client] RTDB shipments subscription error:', error.code);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [user, authLoading]);

  useEffect(() => {
    if (!user?.uid || authLoading) return;
    let mounted = true;
    const unsubscribe = subscribeToVaultRequests((allRequests) => {
      if (!mounted) return;
      const filtered = allRequests.filter(r => r.userId === user.uid || r.userEmail === user.email);
      if (filtered.length > 0) setMyVaultRequests(filtered);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [user, authLoading]);

  useEffect(() => {
    if (!user?.uid || authLoading) return;
    let mounted = true;
    const unsubscribe = subscribeToTransactions(
      user.uid,
      (txns) => { if (mounted) setTransactions(txns); },
      (error) => { console.warn('[Client] RTDB transactions subscription error:', error.code); },
    );
    return () => { mounted = false; unsubscribe(); };
  }, [user, authLoading]);

  useEffect(() => {
    if (!user?.uid || authLoading) return;
    let mounted = true;
    const fetchData = async () => {
      try {
        const token = await user.getIdToken().catch(() => '');
        const params = new URLSearchParams({ userId: user.uid, userEmail: user.email || '', token });
        const res = await fetch(`/api/client/data?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.error) return;
        if (mounted) {
          setAssets(data.assets || []);
          setOrders(data.orders || []);
          setShipments(data.shipments || []);
          setMyVaultRequests(data.vaultRequests || []);
        }
      } catch { /* Silent — RTDB subscriptions provide real-time updates */ }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user, authLoading]);

  // Gold price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/gold-price');
        const data = await res.json();
        setGoldSpotPrice(data.price);
        setPriceChangePercent(data.changePercent || 0);
        setGoldPriceUpdated(data.lastUpdated || '');
        if (data.priceHistory?.length > 0) {
          setPriceHistory(data.priceHistory);
          setPriceLabels(data.labels || []);
        }
      } catch { /* use defaults */ }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 45000);
    return () => clearInterval(interval);
  }, []);

  // Clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const date = d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
      const time = d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      setDashboardClock(`${date}, ${time}`);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Computed Data ──────────────────────────────────────────────
  const totalGoldGrams = assets.filter(a => a.status === 'active').reduce((t, a) => t + a.weight, 0);
  const estimatedValue = Math.round((totalGoldGrams / 31.1035) * goldSpotPrice);
  const activeCount = assets.filter(a => a.status === 'active').length;
  const pendingCount = myVaultRequests.filter(v => v.status === 'pending').length +
    orders.filter(o => o.status === 'pending' || o.status === 'processing').length +
    shipments.filter(s => s.status === 'pending').length;

  const barWeight = assets.filter(a => a.type === 'bar' && a.status === 'active').reduce((t, a) => t + a.weight, 0);
  const coinWeight = assets.filter(a => a.type === 'coin' && a.status === 'active').reduce((t, a) => t + a.weight, 0);
  const jewelleryWeight = assets.filter(a => a.type === 'jewellery' && a.status === 'active').reduce((t, a) => t + a.weight, 0);

  // ── Vault location selection (used by Vault page + Dashboard KPI card) ──
  // Owned vault locations = locations where the client has an APPROVED vault
  // request. These are the only options shown in the location dropdown.
  const ownedVaultKeys = (() => {
    const keys = new Set<string>();
    myVaultRequests
      .filter(v => v.status === 'approved')
      .forEach(v => keys.add(locKey(v.location)));
    return Array.from(keys);
  })();

  // Effective selected key: if the user's selection is no longer owned (e.g.
  // they had one vault and it was rejected/deleted), fall back to the first
  // owned location. Derived during render instead of syncing via useEffect.
  const activeVaultKey = ownedVaultKeys.includes(selectedVaultKey)
    ? selectedVaultKey
    : (ownedVaultKeys[0] || '');

  // Approved vault requests for the selected location
  const selectedApprovedVaults = myVaultRequests.filter(
    v => v.status === 'approved' && locKey(v.location) === activeVaultKey,
  );

  // Permanent "Opened" date = the EARLIEST createdAt among the approved vault
  // requests for this location. Adding new assets or new vaults at the same
  // location never modifies this date.
  const vaultOpenedAt = (() => {
    const times = selectedApprovedVaults
      .map(v => (v.createdAt ? new Date(v.createdAt).getTime() : NaN))
      .filter(n => !isNaN(n));
    return times.length > 0 ? new Date(Math.min(...times)).toISOString() : '';
  })();

  // Assets stored at the selected location
  const assetsForVault = assets.filter(a => locKey(a.vaultLocation) === activeVaultKey);

  const vaultLocation = activeVaultKey
    ? (VAULT_LOCATION_META[activeVaultKey]?.label || activeVaultKey)
    : 'Not Assigned';
  const vaultCountry = activeVaultKey
    ? (VAULT_LOCATION_META[activeVaultKey]?.country || '—')
    : '—';
  const vaultStorageType = selectedApprovedVaults[0]?.storageType
    ? selectedApprovedVaults[0].storageType.charAt(0).toUpperCase() + selectedApprovedVaults[0].storageType.slice(1) + ' Storage'
    : 'Not Assigned';
  const assetTypes = [...new Set(assetsForVault.filter(a => a.status === 'active').map(a =>
    a.type === 'bar' ? 'Gold Bars' : a.type === 'coin' ? 'Gold Coins' : 'Jewellery',
  ))];
  const vaultTotalGoldGrams = assetsForVault.filter(a => a.status === 'active').reduce((t, a) => t + a.weight, 0);
  const vaultEstimatedValue = Math.round((vaultTotalGoldGrams / 31.1035) * goldSpotPrice);

  // Vault requests for the selected location (for the Vault page table)
  const vaultRequestsForLocation = myVaultRequests.filter(r => locKey(r.location) === activeVaultKey);

  // ── Holdings by vault location (for the Dashboard overview card) ──
  // One summary per city where the client currently has active assets,
  // showing the combined grams + value for that location.
  const holdingsByLocation = (() => {
    const map = new Map<string, { key: string; label: string; grams: number; value: number; count: number }>();
    assets.filter(a => a.status === 'active').forEach(a => {
      const k = locKey(a.vaultLocation);
      if (!k) return;
      const meta = VAULT_LOCATION_META[k];
      const label = meta?.label || k;
      const entry = map.get(k) || { key: k, label, grams: 0, value: 0, count: 0 };
      entry.grams += a.weight;
      entry.value += Math.round((a.weight / 31.1035) * goldSpotPrice);
      entry.count += 1;
      map.set(k, entry);
    });
    return Array.from(map.values());
  })();

  // ── Holdings page: assets filtered by the selected vault location ──
  // Falls back to all assets when no vault is owned/selected so the page
  // never blanks out for clients who have assets without an approved vault
  // (edge case).
  const holdingsAssets = activeVaultKey
    ? assets.filter(a => locKey(a.vaultLocation) === activeVaultKey)
    : assets;
  const holdingsTotalGrams = holdingsAssets.filter(a => a.status === 'active').reduce((t, a) => t + a.weight, 0);
  const holdingsEstimatedValue = Math.round((holdingsTotalGrams / 31.1035) * goldSpotPrice);
  const holdingsActiveCount = holdingsAssets.filter(a => a.status === 'active').length;
  const holdingsBarWeight = holdingsAssets.filter(a => a.type === 'bar' && a.status === 'active').reduce((t, a) => t + a.weight, 0);
  const holdingsCoinWeight = holdingsAssets.filter(a => a.type === 'coin' && a.status === 'active').reduce((t, a) => t + a.weight, 0);
  const holdingsJewelleryWeight = holdingsAssets.filter(a => a.type === 'jewellery' && a.status === 'active').reduce((t, a) => t + a.weight, 0);

  const monthlyRate = 0.02;
  const annualFee = Math.round(estimatedValue * (monthlyRate / 100) * 12);

  const storageFeesMonths = (() => {
    const now = new Date();
    const months: string[] = [];
    const amounts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(mStart.toLocaleString('en', { month: 'short' }));
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const gramInMonth = assets
        .filter(a => {
          const created = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          return created < mEnd.getTime() && a.status === 'active';
        })
        .reduce((t, a) => t + a.weight, 0);
      const monthValue = Math.round((gramInMonth / 31.1035) * goldSpotPrice);
      amounts.push(Math.round(monthValue * (monthlyRate / 100)));
    }
    return { months, amounts };
  })();

  const returnsData = (() => {
    if (priceHistory.length < 2) return [0, 0, 0, 0, 0, 0];
    const result: number[] = [];
    const step = Math.max(1, Math.floor(priceHistory.length / 6));
    for (let i = 0; i < 6; i++) {
      const idx = Math.min(i * step, priceHistory.length - 1);
      const prevIdx = Math.max(0, idx - step);
      if (priceHistory[prevIdx] > 0) {
        result.push(parseFloat(((priceHistory[idx] - priceHistory[prevIdx]) / priceHistory[prevIdx] * 100).toFixed(1)));
      } else {
        result.push(0);
      }
    }
    return result;
  })();

  const returnsLabels = (() => {
    const now = new Date();
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      labels.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString('en', { month: 'short' }));
    }
    return labels;
  })();

  const perf1M = priceHistory.length > 30 && priceHistory[priceHistory.length - 31] > 0
    ? ((priceHistory[priceHistory.length - 1] - priceHistory[priceHistory.length - 31]) / priceHistory[priceHistory.length - 31] * 100)
    : 0;
  const perf6M = priceHistory.length > 180 && priceHistory[priceHistory.length - 181] > 0
    ? ((priceHistory[priceHistory.length - 1] - priceHistory[priceHistory.length - 181]) / priceHistory[priceHistory.length - 181] * 100)
    : 0;
  const perf1Y = priceHistory.length > 1 && priceHistory[0] > 0
    ? ((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0] * 100)
    : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = (userProfile?.name || user?.displayName || 'Member').trim().split(/\s+/).filter(Boolean)[0] || 'Member';

  const sectionMeta: Record<string, { label: string; title: string }> = {
    dashboard: { label: 'Overview', title: 'Dashboard' },
    holdings: { label: 'Portfolio', title: 'Holdings' },
    orders: { label: 'Trading', title: 'Orders' },
    shipments: { label: 'Logistics', title: 'Shipments' },
    vault: { label: 'Storage', title: 'Vault' },
    analytics: { label: 'Insights', title: 'Analytics' },
    transactions: { label: 'Payments', title: 'Transactions' },
  };

  if (authLoading || transitionLoading) {
    return <DashboardLoader />;
  }

  const currentSection = sectionMeta[activeNav] || sectionMeta.dashboard;
  const priceUp = priceChangePercent >= 0;

  // Pending views
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');
  const pendingShipments = shipments.filter(s => s.status === 'pending');
  const allNotifications = buildClientNotifications({ assets, orders, shipments, vaultRequests: myVaultRequests, transactions });
  const notifications = allNotifications.filter((n) => !deletedNotificationIds.includes(n.id));
  const unreadNotificationCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length;

  const markNotificationRead = (id: string) => {
    setReadNotificationIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id].slice(-200);
      if (user?.uid) localStorage.setItem(`client_notification_read_${user.uid}`, JSON.stringify(next));
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    const ids = notifications.map((notification) => notification.id).slice(-200);
    setReadNotificationIds(ids);
    if (user?.uid) localStorage.setItem(`client_notification_read_${user.uid}`, JSON.stringify(ids));
  };

  const deleteNotifications = (ids: string[]) => {
    setDeletedNotificationIds((current) => {
      const next = [...new Set([...current, ...ids])].slice(-500);
      if (user?.uid) localStorage.setItem(`client_notification_deleted_${user.uid}`, JSON.stringify(next));
      return next;
    });
    setSelectedNotificationIds([]);
    setIsSelectionMode(false);
  };

  const clearAllNotifications = () => {
    const ids = notifications.map((n) => n.id);
    deleteNotifications(ids);
  };

  const toggleNotificationSelection = (id: string) => {
    setSelectedNotificationIds((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedNotificationIds.length === notifications.length) {
      setSelectedNotificationIds([]);
    } else {
      setSelectedNotificationIds(notifications.map((n) => n.id));
    }
  };

  const deleteSelectedNotifications = () => {
    if (selectedNotificationIds.length > 0) {
      deleteNotifications(selectedNotificationIds);
    }
  };

  const handleChangePassword = () => {
    setProfileMenuOpen(false);
    setChangePasswordOpen(true);
  };

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    await logout();
    router.push('/');
  };

  return (
    <div className="dashboard-scope min-h-screen bg-[#0E1014]">
      {/* ═════════════ Top bar ═════════════ */}
      <nav className="fixed w-full z-50 bg-[#0E1014]/95 backdrop-blur-xl border-b border-[#1c222e]/80">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <a href="/" className="flex items-center gap-2.5 group">
              <svg className="w-7 h-7" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#dLogoGrad)" opacity="0.92" />
                <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#0E1014" />
                <circle cx="20" cy="20" r="2.5" fill="#C9A84C" />
                <defs>
                  <linearGradient id="dLogoGrad" x1="4" y1="4" x2="36" y2="36">
                    <stop stopColor="#D4B96A" />
                    <stop offset="1" stopColor="#A68A3E" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="flex flex-col leading-none">
                <span className="text-[13px] font-bold tracking-[0.18em] text-[#F5F5F5]">APEXSTORAGE</span>
              </div>
            </a>

            <div ref={headerMenuRef} className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setNotificationOpen((open) => !open); setProfileMenuOpen(false); }}
                  className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-[#1c222e] text-[#8A8A8E] hover:text-[#C9A84C] hover:border-[#C9A84C]/35 transition-colors flex items-center justify-center"
                  aria-label="Notifications"
                  aria-expanded={notificationOpen}
                >
                  <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M15 17H9m9-5V9a6 6 0 10-12 0v3l-2 3h16l-2-3zm-5 8a2.5 2.5 0 01-4-2" />
                  </svg>
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-[#C9A84C] text-[9px] font-bold text-[#1A1A1E] flex items-center justify-center ring-2 ring-[#0E1014]">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#1c222e] bg-[#10141D] shadow-2xl">
                    <div className="flex items-center justify-between gap-3 border-b border-[#1c222e] px-4 py-3">
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase">Notifications</p>
                        <p className="mt-1 text-[10px] text-[#5A5A5E]">Recent account activity</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadNotificationCount > 0 && !isSelectionMode && (
                          <button type="button" onClick={markAllNotificationsRead} className="text-[9px] text-[#8A8A8E] hover:text-[#C9A84C] transition-colors whitespace-nowrap">
                            Mark all read
                          </button>
                        )}
                        {!isSelectionMode && notifications.length > 0 && (
                          <button type="button" onClick={() => setIsSelectionMode(true)} className="text-[9px] text-[#8A8A8E] hover:text-[#C9A84C] transition-colors whitespace-nowrap">
                            Select
                          </button>
                        )}
                        {isSelectionMode && (
                          <>
                            <button type="button" onClick={toggleSelectAll} className="text-[9px] text-[#8A8A8E] hover:text-[#C9A84C] transition-colors whitespace-nowrap">
                              {selectedNotificationIds.length === notifications.length ? 'Deselect all' : 'Select all'}
                            </button>
                            <button type="button" onClick={deleteSelectedNotifications} disabled={selectedNotificationIds.length === 0} className="text-[9px] text-red-400 hover:text-red-300 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
                              Delete selected
                            </button>
                            <button type="button" onClick={() => { setIsSelectionMode(false); setSelectedNotificationIds([]); }} className="text-[9px] text-[#8A8A8E] hover:text-[#C9A84C] transition-colors whitespace-nowrap">
                              Cancel
                            </button>
                          </>
                        )}
                        {!isSelectionMode && notifications.length > 0 && (
                          <button type="button" onClick={clearAllNotifications} className="text-[9px] text-red-400 hover:text-red-300 transition-colors whitespace-nowrap">
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[min(24rem,calc(100vh-8rem))] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <p className="text-xs text-[#F5F5F5]">No recent activity</p>
                          <p className="mt-1 text-[10px] text-[#5A5A5E]">Your account updates will appear here.</p>
                        </div>
                      ) : (
                        notifications.map((notification) => {
                          const unread = !readNotificationIds.includes(notification.id);
                          const isSelected = selectedNotificationIds.includes(notification.id);
                          return (
                            <div key={notification.id} className="border-b border-[#1c222e]/70 last:border-b-0">
                              {isSelectionMode ? (
                                <label className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1b212c] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleNotificationSelection(notification.id)}
                                    className="mt-1 h-4 w-4 shrink-0 accent-[#C9A84C] border-[#1c222e] bg-[#0E1014] text-[#C9A84C] focus:ring-[#C9A84C]"
                                  />
                                  <span className={cn(
                                    'min-w-0 flex-1',
                                    unread ? 'bg-[#C9A84C]/[0.035]' : 'bg-transparent',
                                  )}>
                                    <span className={cn(
                                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                                      unread ? 'border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#1c222e] bg-[#0E1014] text-[#5A5A5E]',
                                    )}>
                                      <NotificationGlyph kind={notification.kind} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center gap-2">
                                        <span className="truncate text-[11px] font-semibold text-[#F5F5F5]">{notification.title}</span>
                                        {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A84C]" />}
                                      </span>
                                      <span className="mt-1 block text-[10px] leading-relaxed text-[#8A8A8E]">{notification.description}</span>
                                      <span className="mt-1.5 block text-[9px] text-[#5A5A5E] tabular-nums">{new Date(notification.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                    </span>
                                  </span>
                                </label>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    markNotificationRead(notification.id);
                                    setNotificationOpen(false);
                                    if (notification.nav) setActiveNav(notification.nav);
                                  }}
                                  className={cn(
                                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1b212c]',
                                    unread ? 'bg-[#C9A84C]/[0.035]' : 'bg-transparent',
                                  )}
                                >
                                  <span className={cn(
                                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                                    unread ? 'border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#1c222e] bg-[#0E1014] text-[#5A5A5E]',
                                  )}>
                                    <NotificationGlyph kind={notification.kind} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                      <span className="truncate text-[11px] font-semibold text-[#F5F5F5]">{notification.title}</span>
                                      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A84C]" />}
                                    </span>
                                    <span className="mt-1 block text-[10px] leading-relaxed text-[#8A8A8E]">{notification.description}</span>
                                    <span className="mt-1.5 block text-[9px] text-[#5A5A5E] tabular-nums">{new Date(notification.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-[#1c222e] text-[#8A8A8E] hover:text-[#C9A84C] hover:border-[#C9A84C]/35 transition-colors flex items-center justify-center"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 3v1.5m0 15V21m9-9h-1.5M6.75 12H5.25m15.364-6.364l-1.06 1.06M5.646 18.354l-1.06 1.06m12.728 0l-1.06-1.06M5.646 5.646l-1.06-1.06M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setProfileMenuOpen((open) => !open); setNotificationOpen(false); }}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-[#1c222e] text-[#8A8A8E] hover:text-[#C9A84C] hover:border-[#C9A84C]/35 transition-colors flex items-center justify-center"
                  aria-label="Profile menu"
                  aria-expanded={profileMenuOpen}
                >
                  <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M20 21a8 8 0 00-16 0m12-13a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-lg border border-[#1c222e] bg-[#10141D] py-1 shadow-2xl">
                    <div className="border-b border-[#1c222e] px-4 py-3">
                      <p className="truncate text-xs font-semibold text-[#F5F5F5]">{userProfile?.name || 'Member'}</p>
                      <p className="mt-1 truncate text-[10px] text-[#5A5A5E]">{user?.email || ''}</p>
                    </div>
                    <button type="button" onClick={() => { setProfileMenuOpen(false); setProfileOpen(true); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs text-[#8A8A8E] hover:bg-[#1b212c] hover:text-[#F5F5F5] transition-colors">
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426-1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Profile Settings
                    </button>
                    <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs text-[#8A8A8E] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 text-[#8A8A8E] hover:text-[#C9A84C] transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Sidebar
        type="client"
        activeNav={activeNav}
        onNavChange={setActiveNav}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenProfile={() => setProfileOpen(true)}
        onChangePassword={handleChangePassword}
        goldSpotPrice={goldSpotPrice}
      />

      {/* Modals */}
      <GetVaultModal open={getVaultOpen} onClose={() => setGetVaultOpen(false)} onToast={showToast} />
      <BuyGoldModal open={buyGoldOpen} onClose={() => setBuyGoldOpen(false)} onToast={showToast} goldSpotPrice={goldSpotPrice} />
      <ShipmentWizard open={shipmentOpen} onClose={() => setShipmentOpen(false)} onToast={showToast} assets={assets.filter(a => a.status === 'active')} goldSpotPrice={goldSpotPrice} />
      <PerformanceChart open={performanceOpen} onClose={() => setPerformanceOpen(false)} priceHistory={priceHistory} labels={priceLabels} currentPrice={goldSpotPrice} />
      <ProfileSettings open={profileOpen} onClose={() => setProfileOpen(false)} onToast={showToast} />
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} email={user?.email || ''} onToast={showToast} />
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      {/* ═════════════ Main ═════════════ */}
      <div className="pt-14 pb-10 min-h-screen bg-[#0E1014] lg:ml-64">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── Greeting header ── */}
          <div className="relative overflow-hidden bg-[#10141D] border border-[#1c222e] rounded-lg mt-5 mb-6">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-medium text-[#F5F5F5] tracking-tight truncate">
                  {greeting}, <span className="font-semibold text-[#C9A84C]">{firstName}</span>
                </p>
              </div>
              <div className="shrink-0 text-right border-t border-[#1c222e]/60 sm:border-0 pt-2.5 sm:pt-0">
                <p className="text-[11px] sm:text-sm font-semibold text-[#F5F5F5] font-mono tabular-nums tracking-tight whitespace-nowrap">{dashboardClock}</p>
              </div>
            </div>
          </div>

          {/* ── Section header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-1 h-6 rounded-sm bg-gradient-to-b from-[#D4B96A] to-[#A68A3E]" />
              <div>
                <SectionLabel>{currentSection.label}</SectionLabel>
                <h1 className="text-xl font-bold text-[#F5F5F5] tracking-tight leading-tight">{currentSection.title}</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeNav === 'dashboard' && (
                <>
                  <button onClick={() => setGetVaultOpen(true)} className="btn-gold text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Get Vault
                  </button>
                  <button onClick={() => setBuyGoldOpen(true)} className="btn-gold text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Buy Gold
                  </button>
                  <button onClick={() => setShipmentOpen(true)} className="btn-gold-outline text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    Shipment
                  </button>
                </>
              )}
              {activeNav === 'holdings' && (
                <button onClick={() => setBuyGoldOpen(true)} className="btn-gold text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Buy Gold
                </button>
              )}
              {activeNav === 'orders' && (
                <button onClick={() => setBuyGoldOpen(true)} className="btn-gold text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Buy Gold
                </button>
              )}
              {activeNav === 'shipments' && (
                <button onClick={() => setShipmentOpen(true)} className="btn-gold text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  New Shipment
                </button>
              )}
              {activeNav === 'vault' && (
                <button onClick={() => setGetVaultOpen(true)} className="btn-gold text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  Get Vault
                </button>
              )}
              {activeNav === 'analytics' && (
                <button onClick={() => setPerformanceOpen(true)} className="btn-gold-outline text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                  Performance Chart
                </button>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              SECTION: Dashboard (overview)
              ═══════════════════════════════════════════════════════════ */}
          {activeNav === 'dashboard' && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                {/* Portfolio Value */}
                <div className="relative bg-[#10141D] border border-[#C9A84C]/25 rounded-lg p-3 sm:p-4 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/70 to-transparent" />
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-[#5A5A5E] uppercase">Portfolio Value</p>
                    <span className="text-[7px] sm:text-[8px] text-[#5A5A5E] tracking-wide truncate">{goldPriceUpdated ? `Updated ${goldPriceUpdated}` : 'Loading…'}</span>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-[#F5F5F5] tabular-nums tracking-tight mt-2 truncate">${formatNumber(estimatedValue)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold tabular-nums', priceUp ? 'text-emerald-400' : 'text-red-400')}>
                      <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">{priceUp ? <path d="M6 2L2 7h8z" /> : <path d="M6 10L2 5h8z" />}</svg>
                      {priceUp ? '+' : ''}{priceChangePercent.toFixed(2)}%
                    </span>
                    <span className="text-[9px] text-[#5A5A5E] tracking-wide uppercase">24h · Live</span>
                  </div>
                </div>

                {/* Performance */}
                <div className="relative bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-[#5A5A5E] uppercase">Performance</p>
                    <button onClick={() => setPerformanceOpen(true)} className="text-[8px] sm:text-[9px] text-[#C9A84C] hover:underline tracking-[0.15em] uppercase">Chart</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { k: '1M', v: perf1M },
                      { k: '6M', v: perf6M },
                      { k: '1Y', v: perf1Y, hl: true },
                    ].map(p => (
                      <div key={p.k} className="text-center min-w-0">
                        <p className="text-[8px] sm:text-[9px] text-[#5A5A5E] tracking-[0.1em] uppercase">{p.k}</p>
                        <p className={cn('text-sm sm:text-base font-bold tabular-nums mt-0.5 truncate', p.hl ? 'text-[#C9A84C]' : 'text-[#F5F5F5]')}>
                          {p.v >= 0 ? '+' : ''}{p.v.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pending */}
                <button onClick={() => setActiveNav('orders')} className="text-left relative bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 hover:border-[#C9A84C]/40 transition-colors group">
                  <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-[#5A5A5E] uppercase">Pending</p>
                  <p className="text-2xl font-bold text-[#C9A84C] tabular-nums tracking-tight mt-2">{pendingCount}</p>
                  <p className="text-[9px] text-[#5A5A5E] tracking-wide uppercase mt-2 flex items-center gap-1">
                    Awaiting
                    <svg className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h6m0 0L7 4m2 2L7 8" /></svg>
                  </p>
                </button>

                {/* Vault Location */}
                <div className="relative bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-1 gap-1.5 min-w-0">
                    <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-[#5A5A5E] uppercase shrink-0">Vault Location</p>
                    <VaultLocationSelect value={activeVaultKey} onChange={setSelectedVaultKey} ownedKeys={ownedVaultKeys} />
                  </div>
                  <p className="text-[10px] text-[#8A8A8E] mt-2 truncate">{vaultCountry}</p>
                  <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-[#1c222e]/60 space-y-1.5">
                    <div className="flex justify-between items-center gap-2"><p className="text-[9px] sm:text-[10px] text-[#5A5A5E] uppercase tracking-wide shrink-0">Storage</p><p className="text-[9px] sm:text-[10px] font-medium text-[#F5F5F5] truncate text-right">{vaultStorageType}</p></div>
                    <div className="flex justify-between items-center gap-2"><p className="text-[9px] sm:text-[10px] text-[#5A5A5E] uppercase tracking-wide shrink-0">Assets</p><p className="text-[9px] sm:text-[10px] font-medium text-[#F5F5F5] truncate text-right">{assetTypes.length > 0 ? assetTypes.join(', ') : 'None'}</p></div>
                    <div className="flex justify-between items-center gap-2"><p className="text-[9px] sm:text-[10px] text-[#5A5A5E] uppercase tracking-wide shrink-0">Opened</p><p className="text-[9px] sm:text-[10px] font-medium text-[#F5F5F5] truncate text-right">{vaultOpenedAt ? new Date(vaultOpenedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
                  </div>
                </div>
              </div>

              {/* Holdings summary + Storage fees */}
              <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 lg:col-span-2 min-w-0">
                  <CardHeader
                    title="Holdings"
                    action={<button onClick={() => setActiveNav('holdings')} className="text-[9px] sm:text-[10px] text-[#C9A84C] hover:underline tracking-[0.15em] uppercase whitespace-nowrap">View All</button>}
                  />
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                    <div className="bg-[#0E1014] border border-[#1c222e] rounded-md p-2.5 sm:p-3">
                      <p className="text-[8px] sm:text-[9px] text-[#5A5A5E] tracking-[0.15em] uppercase">Total Holdings</p>
                      <p className="text-lg sm:text-xl font-bold text-[#F5F5F5] tabular-nums mt-1">{totalGoldGrams}<span className="text-[10px] sm:text-xs text-[#5A5A5E] ml-0.5">g</span></p>
                    </div>
                    <div className="bg-[#0E1014] border border-[#1c222e] rounded-md p-2.5 sm:p-3">
                      <p className="text-[8px] sm:text-[9px] text-[#5A5A5E] tracking-[0.15em] uppercase">Current Value</p>
                      <p className="text-lg sm:text-xl font-bold text-[#C9A84C] tabular-nums mt-1 truncate">${formatNumber(estimatedValue)}</p>
                    </div>
                  </div>
                  {holdingsByLocation.length > 0 ? (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#1c222e]">
                            <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Vault</th>
                            <th className="text-right py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Total Weight</th>
                            <th className="text-right py-2 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Total Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdingsByLocation.map((loc) => (
                            <tr key={loc.key} className="border-b border-[#1c222e]/40 hover:bg-white/[0.015] transition-colors">
                              <td className="py-2.5 pr-3 text-[#F5F5F5]">{loc.label}</td>
                              <td className="py-2.5 pr-3 text-right text-[#F5F5F5] tabular-nums">{loc.grams}<span className="text-[#5A5A5E] ml-0.5 text-[10px]">g</span></td>
                              <td className="py-2.5 text-right text-[#C9A84C] font-semibold tabular-nums">${formatNumber(loc.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-[#5A5A5E] tracking-[0.15em] uppercase">No assets yet — click &quot;Buy Gold&quot; to get started.</p>
                    </div>
                  )}
                </div>

                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 min-w-0">
                  <CardHeader title="Storage Fees" caption="Custody + insurance" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2"><p className="text-[10px] sm:text-[11px] text-[#5A5A5E] shrink-0">Monthly Rate</p><p className="text-[10px] sm:text-[11px] font-medium text-[#F5F5F5] tabular-nums">{monthlyRate}%<span className="text-[#5A5A5E] ml-1">/g</span></p></div>
                    <div className="flex justify-between items-center gap-2"><p className="text-[10px] sm:text-[11px] text-[#5A5A5E] shrink-0">Total Grams</p><p className="text-[10px] sm:text-[11px] font-medium text-[#F5F5F5] tabular-nums">{totalGoldGrams}<span className="text-[#5A5A5E] ml-0.5 text-[9px] sm:text-[10px]">g</span></p></div>
                    <div className="flex justify-between items-center gap-2 pt-2 border-t border-[#1c222e]/60"><p className="text-[10px] sm:text-[11px] text-[#C9A84C] font-semibold uppercase tracking-wide shrink-0">Annual Fee</p><p className="text-xs sm:text-sm font-bold text-[#C9A84C] tabular-nums">${annualFee.toFixed(0)}</p></div>
                  </div>
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[#1c222e]/60">
                    <p className="text-[8px] sm:text-[9px] text-[#5A5A5E] tracking-[0.15em] uppercase mb-2">Monthly Fees · 6M</p>
                    <div className="h-20">
                      <StorageFeesChart months={storageFeesMonths.months} amounts={storageFeesMonths.amounts} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Requests */}
              {pendingCount > 0 ? (
                <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mt-6">
                  <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-[#F5F5F5] uppercase">Vault Requests</h3>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#C9A84C]/10 text-[#C9A84C] font-bold tabular-nums">{myVaultRequests.length}</span>
                    </div>
                    {myVaultRequests.length > 0 ? (
                      <div className="space-y-2.5">
                        {myVaultRequests.map((request) => (
                          <div key={request.id} className="p-3 rounded-md border border-[#1c222e] hover:border-[#C9A84C]/30 transition-colors bg-[#0E1014]">
                            <div className="flex items-start justify-between mb-1.5">
                              <span className="text-[11px] font-medium text-[#F5F5F5] capitalize">{request.storageType || 'Vault'}</span>
                              <StatusBadge status={request.status} />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#5A5A5E] tabular-nums">
                              <span className="capitalize">{request.location} · {request.quantity}g</span><span>{request.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[10px] text-[#5A5A5E] tracking-[0.15em] uppercase text-center py-4">No vault requests yet.</p>}
                  </div>

                  <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-[#F5F5F5] uppercase">Orders</h3>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#C9A84C]/10 text-[#C9A84C] font-bold tabular-nums">{pendingOrders.length}</span>
                    </div>
                    {pendingOrders.length > 0 ? (
                      <div className="space-y-2.5">
                        {pendingOrders.map((order) => (
                          <div key={order.id} className="p-3 rounded-md border border-[#1c222e] hover:border-[#C9A84C]/30 transition-colors bg-[#0E1014]">
                            <div className="flex items-start justify-between mb-1.5">
                              <span className="text-[11px] font-medium text-[#F5F5F5]">{order.type}</span>
                              <StatusBadge status={order.status} />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#5A5A5E] tabular-nums">
                              <span>${(order.estimatedTotal || 0).toLocaleString()} · {order.quantityGrams}g</span><span>{order.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[10px] text-[#5A5A5E] tracking-[0.15em] uppercase text-center py-4">No pending orders</p>}
                  </div>

                  <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-[#F5F5F5] uppercase">Shipments</h3>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#C9A84C]/10 text-[#C9A84C] font-bold tabular-nums">{pendingShipments.length}</span>
                    </div>
                    {pendingShipments.length > 0 ? (
                      <div className="space-y-2.5">
                        {pendingShipments.map((shipment) => (
                          <div key={shipment.id} className="p-3 rounded-md border border-[#1c222e] hover:border-[#C9A84C]/30 transition-colors bg-[#0E1014]">
                            <div className="flex items-start justify-between mb-1.5">
                              <span className="text-[11px] font-medium text-[#F5F5F5]">{shipment.shippingAmount === 'ship_full' ? 'Full' : 'Partial'}</span>
                              <StatusBadge status={shipment.status} />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#5A5A5E] tabular-nums">
                              <span className="font-mono">{shipment.assetRef} · {shipment.weight}g</span><span>{shipment.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[10px] text-[#5A5A5E] tracking-[0.15em] uppercase text-center py-4">No pending shipments</p>}
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <div className="relative overflow-hidden bg-[#10141D] border border-[#1c222e] rounded-lg p-8 text-center">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                    <div className="w-11 h-11 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-[#F5F5F5] tracking-tight">All caught up</p>
                    <p className="text-[10px] text-[#5A5A5E] mt-1 tracking-wide uppercase">No pending requests, orders, or shipments</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION: Holdings
              ═══════════════════════════════════════════════════════════ */}
          {activeNav === 'holdings' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <StatTile label="Total Holdings" value={<>{holdingsTotalGrams}<span className="text-sm text-[#5A5A5E] ml-1">g</span></>} />
                <StatTile label="Current Value" value={<span className="text-[#C9A84C]">${formatNumber(holdingsEstimatedValue)}</span>} />
                <StatTile label="Pending" value={<span className="text-amber-400">{holdingsAssets.filter(a => a.status === 'pending').length}</span>} />
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-4 lg:col-span-2 min-w-0">
                  <CardHeader
                    title="Asset Inventory"
                    caption="Live holdings ledger"
                    action={
                      <div className="flex items-center gap-2">
                        <StatusBadge status="active" />
                        <VaultLocationSelect value={activeVaultKey} onChange={setSelectedVaultKey} ownedKeys={ownedVaultKeys} />
                      </div>
                    }
                  />
                  {holdingsAssets.length > 0 ? (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#1c222e]">
                            <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Ref</th>
                            <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Type</th>
                            <th className="text-right py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Weight</th>
                            <th className="text-right py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Value</th>
                            <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Vault</th>
                            <th className="text-left py-2 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdingsAssets.map((asset) => {
                            const value = Math.round((asset.weight / 31.1035) * goldSpotPrice);
                            return (
                              <tr key={asset.id} className="border-b border-[#1c222e]/40 hover:bg-white/[0.015] transition-colors">
                                <td className="py-2.5 pr-3 font-mono text-[11px] text-[#F5F5F5] whitespace-nowrap">{asset.ref}</td>
                                <td className="py-2.5 pr-3 text-[#F5F5F5]">{asset.type === 'bar' ? 'Bar' : asset.type === 'coin' ? 'Coin' : 'Jewellery'}</td>
                                <td className="py-2.5 pr-3 text-right text-[#F5F5F5] tabular-nums">{asset.weight}<span className="text-[#5A5A5E] ml-0.5 text-[10px]">g</span></td>
                                <td className="py-2.5 pr-3 text-right text-[#C9A84C] font-semibold tabular-nums">${value.toLocaleString()}</td>
                                <td className="py-2.5 pr-3 text-[#8A8A8E] capitalize">{asset.vaultLocation || '—'}</td>
                                <td className="py-2.5"><StatusBadge status={asset.status === 'active' ? 'added' : asset.status} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                      title="No Holdings Yet"
                      desc="Purchase gold to start building your portfolio."
                      action={<button onClick={() => setBuyGoldOpen(true)} className="btn-gold text-xs">Buy Gold</button>}
                    />
                  )}
                </div>

                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-4 min-w-0">
                  <CardHeader title="Allocation" caption="By gold type (weight)" />
                  <AllocationDonut bars={holdingsBarWeight} coins={holdingsCoinWeight} jewellery={holdingsJewelleryWeight} />
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION: Orders
              ═══════════════════════════════════════════════════════════ */}
          {activeNav === 'orders' && (
            <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-4 min-w-0">
              <CardHeader title="Order History" caption="All buy / sell orders" />
              {orders.length > 0 ? (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1c222e]">
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">ID</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Type</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Product</th>
                        <th className="text-right py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Quantity</th>
                        <th className="text-right py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Total</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Vault</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Status</th>
                        <th className="text-left py-2 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-[#1c222e]/40 hover:bg-white/[0.015] transition-colors">
                          <td className="py-2.5 pr-3 font-mono text-[11px] text-[#8A8A8E] whitespace-nowrap">{order.id.slice(0, 8)}</td>
                          <td className="py-2.5 pr-3 text-[#F5F5F5]">{order.type}</td>
                          <td className="py-2.5 pr-3 text-[#F5F5F5] capitalize">{order.productType || '—'}</td>
                          <td className="py-2.5 pr-3 text-right text-[#F5F5F5] tabular-nums">{order.quantityGrams}<span className="text-[#5A5A5E] ml-0.5 text-[10px]">g</span></td>
                          <td className="py-2.5 pr-3 text-right text-[#C9A84C] font-semibold tabular-nums">${(order.estimatedTotal || 0).toLocaleString()}</td>
                          <td className="py-2.5 pr-3 text-[#8A8A8E] capitalize">{order.vault || '—'}</td>
                          <td className="py-2.5 pr-3"><StatusBadge status={order.status} /></td>
                          <td className="py-2.5 text-[#5A5A5E] whitespace-nowrap tabular-nums">{order.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                  title="No Orders Yet"
                  desc="Place your first order to buy gold."
                  action={<button onClick={() => setBuyGoldOpen(true)} className="btn-gold text-xs">Buy Gold</button>}
                />
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION: Transactions
              ═══════════════════════════════════════════════════════════ */}
          {activeNav === 'transactions' && (
            <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-4 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#F5F5F5] uppercase">Payment Transactions</h3>
                  <p className="text-[10px] text-[#5A5A5E] mt-1 tracking-wide">Crypto settlement history</p>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#C9A84C]/10 text-[#C9A84C] font-bold tabular-nums">{transactions.length}</span>
              </div>
              <TransactionHistory transactions={transactions} />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION: Shipments
              ═══════════════════════════════════════════════════════════ */}
          {activeNav === 'shipments' && (
            <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-4 min-w-0">
              <CardHeader title="Shipment History" caption="Insured delivery requests" />
              {shipments.length > 0 ? (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1c222e]">
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">ID</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Asset Ref</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Type</th>
                        <th className="text-right py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Weight</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Destination</th>
                        <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Status</th>
                        <th className="text-left py-2 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.map((shipment) => (
                        <tr key={shipment.id} className="border-b border-[#1c222e]/40 hover:bg-white/[0.015] transition-colors">
                          <td className="py-2.5 pr-3 font-mono text-[11px] text-[#8A8A8E] whitespace-nowrap">{shipment.id.slice(0, 8)}</td>
                          <td className="py-2.5 pr-3 font-mono text-[11px] text-[#F5F5F5] whitespace-nowrap">{shipment.assetRef}</td>
                          <td className="py-2.5 pr-3 text-[#F5F5F5]">{shipment.shippingAmount === 'ship_full' ? 'Full' : 'Partial'}</td>
                          <td className="py-2.5 pr-3 text-right text-[#F5F5F5] tabular-nums">{shipment.weight}<span className="text-[#5A5A5E] ml-0.5 text-[10px]">g</span></td>
                          <td className="py-2.5 pr-3 text-[#8A8A8E]">{shipment.deliveryCity}{shipment.deliveryCountry ? `, ${shipment.deliveryCountry}` : ''}</td>
                          <td className="py-2.5 pr-3"><StatusBadge status={shipment.status} /></td>
                          <td className="py-2.5 text-[#5A5A5E] whitespace-nowrap tabular-nums">{shipment.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>}
                  title="No Shipments Yet"
                  desc="Request a shipment for your stored assets."
                  action={<button onClick={() => setShipmentOpen(true)} className="btn-gold text-xs">New Shipment</button>}
                />
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION: Vault
              ═══════════════════════════════════════════════════════════ */}
          {activeNav === 'vault' && (
            <>
              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 min-w-0">
                  <CardHeader title="Vault Information" caption="Custody arrangement" action={<VaultLocationSelect value={activeVaultKey} onChange={setSelectedVaultKey} ownedKeys={ownedVaultKeys} />} />
                  <div className="space-y-2">
                    {[
                      { k: 'Location', v: vaultLocation },
                      { k: 'Country', v: vaultCountry },
                      { k: 'Storage Type', v: vaultStorageType },
                      { k: 'Assets Stored', v: assetTypes.length > 0 ? assetTypes.join(', ') : 'None' },
                      { k: 'Total Gold', v: <span className="text-[#C9A84C] tabular-nums">{vaultTotalGoldGrams}g <span className="text-[#5A5A5E]">·</span> ${formatNumber(vaultEstimatedValue)}</span> },
                      { k: 'Opened', v: vaultOpenedAt ? new Date(vaultOpenedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                    ].map(row => (
                      <div key={row.k} className="flex justify-between items-center gap-2 py-1.5 border-b border-[#1c222e]/40 last:border-0">
                        <p className="text-[10px] sm:text-[11px] text-[#5A5A5E] uppercase tracking-wide shrink-0">{row.k}</p>
                        <p className="text-[10px] sm:text-[11px] font-medium text-[#F5F5F5] truncate text-right">{row.v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 min-w-0">
                  <CardHeader title="Storage Fees" caption="Custody + insurance" />
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center gap-2"><p className="text-[10px] sm:text-[11px] text-[#5A5A5E] shrink-0">Monthly Rate</p><p className="text-[10px] sm:text-[11px] font-medium text-[#F5F5F5] tabular-nums">{monthlyRate}%<span className="text-[#5A5A5E] ml-1">/g</span></p></div>
                    <div className="flex justify-between items-center gap-2"><p className="text-[10px] sm:text-[11px] text-[#5A5A5E] shrink-0">Total Grams</p><p className="text-[10px] sm:text-[11px] font-medium text-[#F5F5F5] tabular-nums">{totalGoldGrams}<span className="text-[#5A5A5E] ml-0.5 text-[9px] sm:text-[10px]">g</span></p></div>
                    <div className="flex justify-between items-center gap-2"><p className="text-[10px] sm:text-[11px] text-[#5A5A5E] shrink-0">Monthly Fee</p><p className="text-[10px] sm:text-[11px] font-medium text-[#C9A84C] tabular-nums">${(totalGoldGrams * monthlyRate).toFixed(0)}</p></div>
                    <div className="flex justify-between items-center gap-2 pt-2 border-t border-[#1c222e]/60"><p className="text-[10px] sm:text-[11px] text-[#C9A84C] font-semibold uppercase tracking-wide shrink-0">Annual Fee</p><p className="text-xs sm:text-sm font-bold text-[#C9A84C] tabular-nums">${annualFee.toFixed(0)}</p></div>
                  </div>
                  <div className="border-t border-[#1c222e]/60 pt-4">
                    <p className="text-[9px] text-[#5A5A5E] tracking-[0.15em] uppercase mb-2">Monthly Fees · 6M</p>
                    <div className="h-28">
                      <StorageFeesChart months={storageFeesMonths.months} amounts={storageFeesMonths.amounts} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 mt-6 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#F5F5F5] uppercase">Vault Requests</h3>
                    <p className="text-[10px] text-[#5A5A5E] mt-1 tracking-wide">Submitted custody applications</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#C9A84C]/10 text-[#C9A84C] font-bold tabular-nums">{vaultRequestsForLocation.length}</span>
                </div>
                {vaultRequestsForLocation.length > 0 ? (
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1c222e]">
                          <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">ID</th>
                          <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Location</th>
                          <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Type</th>
                          <th className="text-right py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Quantity</th>
                          <th className="text-left py-2 pr-3 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Status</th>
                          <th className="text-left py-2 text-[9px] tracking-[0.12em] text-[#5A5A5E] uppercase font-bold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vaultRequestsForLocation.map((request) => (
                          <tr key={request.id} className="border-b border-[#1c222e]/40 hover:bg-white/[0.015] transition-colors">
                            <td className="py-2.5 pr-3 font-mono text-[11px] text-[#8A8A8E] whitespace-nowrap">{request.id.slice(0, 8)}</td>
                            <td className="py-2.5 pr-3 text-[#F5F5F5]">{request.location}</td>
                            <td className="py-2.5 pr-3 text-[#F5F5F5] capitalize">{request.storageType}</td>
                            <td className="py-2.5 pr-3 text-right text-[#F5F5F5] tabular-nums">{request.quantity}<span className="text-[#5A5A5E] ml-0.5 text-[10px]">g</span></td>
                            <td className="py-2.5 pr-3"><StatusBadge status={request.status} /></td>
                            <td className="py-2.5 text-[#5A5A5E] whitespace-nowrap tabular-nums">{request.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    title="No Vault Requests"
                    desc="Request a vault to start storing your gold."
                    action={<button onClick={() => setGetVaultOpen(true)} className="btn-gold text-xs">Get Vault</button>}
                  />
                )}
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SECTION: Analytics
              ═══════════════════════════════════════════════════════════ */}
          {activeNav === 'analytics' && (
            <>
              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4">
                  <CardHeader title="Portfolio Allocation" caption="By gold type (weight)" />
                  <AllocationDonut bars={barWeight} coins={coinWeight} jewellery={jewelleryWeight} />
                </div>

                <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4">
                  <CardHeader title="Monthly Returns" caption="Portfolio performance · last 6 months" />
                  <div className="flex gap-4 mb-3">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#C9A84C' }} /><span className="text-[9px] sm:text-[10px] text-[#5A5A5E]">Gain</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#EF4444' }} /><span className="text-[9px] sm:text-[10px] text-[#5A5A5E]">Loss</span></div>
                  </div>
                  <div className="h-36">
                    <ReturnsBar data={returnsData} labels={returnsLabels} />
                  </div>
                </div>
              </div>

              <div className="bg-[#10141D] border border-[#1c222e] rounded-lg p-3 sm:p-4 mt-6">
                <CardHeader title="Storage Fees Trend" caption="Monthly storage costs · 6M" />
                <div className="h-40">
                  <StorageFeesChart months={storageFeesMonths.months} amounts={storageFeesMonths.amounts} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Loader ──────────────────────────────────────────────────
function DashboardLoader() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + Math.floor(Math.random() * 15 + 5);
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-scope min-h-screen bg-[#0E1014] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[#C9A84C]/5 blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="flex flex-col items-center z-10 max-w-xs text-center px-4">
        <div className="relative mb-8 animate-pulse">
          <svg className="w-16 h-16 drop-shadow-[0_0_15px_rgba(201,168,76,0.3)]" viewBox="0 0 40 40" fill="none">
            <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#loaderLogoGrad)" opacity="0.95" />
            <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#0E1014" />
            <circle cx="20" cy="20" r="2.5" fill="#C9A84C" />
            <defs>
              <linearGradient id="loaderLogoGrad" x1="4" y1="4" x2="36" y2="36">
                <stop stopColor="#D4B96A" />
                <stop offset="1" stopColor="#A68A3E" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute rounded-full border border-[#C9A84C]/25 animate-ping opacity-40 pointer-events-none" style={{ inset: 0, animationDuration: '2s' }} />
        </div>
        <div className="relative w-12 h-12 mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-[#C9A84C]/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#C9A84C] animate-spin" />
        </div>
        <p className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase mb-1">Secure Handshake</p>
        <p className="text-[9px] font-medium tracking-[0.15em] text-[#5A5A5E] uppercase mb-3 font-mono">
          Retrieving vault data… {Math.min(percent, 100)}%
        </p>
        <div className="w-40 h-[2px] bg-[#1c222e] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#D4B96A] to-[#A68A3E] transition-all duration-300 ease-out" style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
