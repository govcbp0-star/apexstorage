'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import Sidebar from '@/components/layout/Sidebar';
import ProfileSettings from '@/components/modals/ProfileSettings';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';
import { cn } from '@/lib/utils';

// Dynamic imports for Chart.js components — avoid SSR canvas issues
const VaultDonut = dynamic(() => import('@/components/charts/VaultDonut'), { ssr: false });
const GrowthBar = dynamic(() => import('@/components/charts/GrowthBar'), { ssr: false });
const StorageFeesChart = dynamic(() => import('@/components/charts/StorageFeesChart'), { ssr: false });
const PerformanceChart = dynamic(() => import('@/components/modals/PerformanceChart'), { ssr: false });
import { ContactMessage, subscribeToMessages, markMessageRead, deleteMessage as deleteMessageRTDB } from '@/lib/messages';
import { VaultRequest, subscribeToVaultRequests, updateVaultRequestStatus, deleteVaultRequest as deleteVaultRequestRTDB } from '@/lib/vault-requests';
import { UserRecord, subscribeToUsers, updateUser as updateUserRTDB, deleteUser as deleteUserRTDB } from '@/lib/users-service';
import { AssetRecord, subscribeToAssets, addAsset as addAssetRTDB, updateAsset as updateAssetRTDB, deleteAsset as deleteAssetRTDB } from '@/lib/assets-service';
import { Order, subscribeToOrders, updateOrderStatus as updateOrderStatusRTDB, deleteOrder as deleteOrderRTDB } from '@/lib/orders-service';
import { Shipment, subscribeToShipments, updateShipmentStatus as updateShipmentStatusRTDB, deleteShipment as deleteShipmentRTDB } from '@/lib/shipments-service';
import { NewsletterSubscriber, subscribeToNewsletterSubscribers } from '@/lib/newsletter';
import { Transaction, getAllTransactions } from '@/lib/transactions-service';
import TransactionHistory from '@/components/TransactionHistory';

function Toast({ message, type, visible }: { message: string; type: string; visible: boolean }) {
  if (!visible) return null;
  const colors: Record<string, string> = {
    success: 'bg-green-500/10 border-green-500/20 text-green-500',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    info: 'bg-[#38BDF8]/10 border-[#38BDF8]/20 text-[#38BDF8]',
  };
  return (
    <div className={`fixed bottom-6 right-6 z-[200] px-4 py-2.5 border rounded-lg ${colors[type] || colors.info} text-xs font-medium tracking-wide`}>
      {message}
    </div>
  );
}

// No default data — all data comes from RTDB in real-time

type NotificationKind = 'purchase' | 'shipment' | 'vault' | 'payment' | 'asset' | 'user' | 'message';

interface AdminNotification {
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

function buildAdminNotifications({
  users,
  assets,
  orders,
  shipments,
  vaultRequests,
  transactions,
  messages,
}: {
  users: UserRecord[];
  assets: AssetRecord[];
  orders: Order[];
  shipments: Shipment[];
  vaultRequests: VaultRequest[];
  transactions: Transaction[];
  messages: ContactMessage[];
}): AdminNotification[] {
  const notifications: AdminNotification[] = [];
  const add = (notification: AdminNotification) => notifications.push(notification);

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
      description: `${order.userName || 'Client'} · ${order.quantityGrams || 0}g ${order.productType || 'gold'} · ${order.vault || 'Vault allocation'}`,
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
      description: `${shipment.userName || 'Client'} · ${shipment.weight || 0}g · ${shipment.deliveryCity || shipment.deliveryCountry || 'Delivery request'}`,
      timestamp: notificationTime(shipment.createdAt, shipment.date),
      nav: 'approvals',
    });
  });

  vaultRequests.forEach((request) => {
    const status = (request.status || 'pending').toLowerCase();
    add({
      id: `vault-${request.id}`,
      kind: 'vault',
      title: `Vault request ${status}`,
      description: `${request.userName || 'Client'} · ${request.quantity || 0}g · ${request.location || 'Vault location'}`,
      timestamp: notificationTime(request.createdAt, request.date),
      nav: 'vaults',
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
      nav: 'assets',
    });
  });

  users.forEach((u) => {
    add({
      id: `user-${u.id}`,
      kind: 'user',
      title: 'New user registered',
      description: `${u.name || 'Member'} · ${u.email || ''}`,
      timestamp: notificationTime(u.createdAt, u.joined),
      nav: 'users',
    });
  });

  messages.forEach((message) => {
    add({
      id: `message-${message.id}`,
      kind: 'message',
      title: 'New contact message',
      description: `${message.name || 'Visitor'} · ${message.subject || 'General enquiry'}`,
      timestamp: notificationTime(message.date),
      nav: 'messages',
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
    user: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    message: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  };

  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d={paths[kind]} />
    </svg>
  );
}


export default function AdminDashboard() {
  const { authRole, user, userProfile, loading: authLoading, logout, pending2FA } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [transitionLoading, setTransitionLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTransitionLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('overview');
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>([]);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [goldSpotPrice, setGoldSpotPrice] = useState(4744.08);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [priceLabels, setPriceLabels] = useState<string[]>([]);
  const [dashboardClock, setDashboardClock] = useState('');

  // Admin data state — all from RTDB real-time
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [vaultRequests, setVaultRequests] = useState<VaultRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modals for CRUD
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'client', status: 'active', vaultLocation: '' });
  const [assetForm, setAssetForm] = useState({ ref: '', type: 'bar', weight: '', status: 'active', vaultLocation: 'zurich', userId: '' });
  const [vaultFormAdmin, setVaultFormAdmin] = useState({ location: '', type: '', userId: '', notes: '' });
  const [selectedVaultRequest, setSelectedVaultRequest] = useState<VaultRequest | null>(null);
  const [vaultDetailOpen, setVaultDetailOpen] = useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderFilter, setOrderFilter] = useState('all');

  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  // Newsletter subscribers
  const [newsletterSubs, setNewsletterSubs] = useState<NewsletterSubscriber[]>([]);

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
        const storedRead = localStorage.getItem(`admin_notification_read_${user.uid}`);
        const parsedRead = storedRead ? JSON.parse(storedRead) : [];
        setReadNotificationIds(Array.isArray(parsedRead) ? parsedRead : []);

        const storedDeleted = localStorage.getItem(`admin_notification_deleted_${user.uid}`);
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
      } else if (authRole !== 'admin') {
        router.push('/');
      }
    }
  }, [authRole, authLoading, pending2FA, router]);

  // Gold price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/gold-price');
        const data = await res.json();
        setGoldSpotPrice(data.price);
        if (data.priceHistory?.length > 0) { setPriceHistory(data.priceHistory); setPriceLabels(data.labels || []); }
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

  // Subscribe to users from RTDB in real-time (falls back to API if RTDB rules block)
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const trySubscribe = () => {
      unsubscribe = subscribeToUsers(
        (rtbUsers) => {
          if (mounted) setUsers(rtbUsers);
        },
        async (error) => {
          // RTDB permission denied — fall back to server-side API
          console.warn('[Admin] RTDB users subscription failed, falling back to API:', error.code);
          try {
            const res = await fetch('/api/admin/data');
            const data = await res.json();
            if (mounted && data.users) setUsers(data.users);
            if (mounted && data.vaultRequests) setVaultRequests(data.vaultRequests);
            if (mounted && data.messages) setMessages(data.messages);
            if (mounted && data.assets) setAssets(data.assets);
          } catch (apiErr) {
            console.error('[Admin] API fallback also failed:', apiErr);
          }
        }
      );
    };

    trySubscribe();
    return () => { mounted = false; if (unsubscribe) unsubscribe(); };
  }, [authLoading, authRole]);

  // Subscribe to assets from RTDB in real-time
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const trySubscribe = () => {
      unsubscribe = subscribeToAssets(
        (rtbAssets) => {
          if (mounted) setAssets(rtbAssets);
        },
        (error) => {
          console.warn('[Admin] RTDB assets subscription failed:', error.code);
        }
      );
    };

    trySubscribe();
    return () => { mounted = false; if (unsubscribe) unsubscribe(); };
  }, [authLoading, authRole]);

  // Subscribe to contact messages from RTDB in real-time
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    const unsubscribe = subscribeToMessages((rtbMessages) => {
      if (mounted) setMessages(rtbMessages);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [authLoading, authRole]);

  // Subscribe to vault requests from RTDB in real-time
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    const unsubscribe = subscribeToVaultRequests((rtbRequests) => {
      if (mounted) setVaultRequests(rtbRequests);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [authLoading, authRole]);

  // Subscribe to orders from RTDB in real-time
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    const unsubscribe = subscribeToOrders((rtbOrders) => {
      if (mounted) setOrders(rtbOrders);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [authLoading, authRole]);

  // Subscribe to shipments from RTDB in real-time
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    const unsubscribe = subscribeToShipments((rtbShipments) => {
      if (mounted) setShipments(rtbShipments);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [authLoading, authRole]);

  // Fetch all transactions
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    const fetchTransactions = async () => {
      try {
        const allTxns = await getAllTransactions();
        if (mounted) setTransactions(allTxns);
      } catch (error) {
        console.warn('[Admin] Failed to fetch transactions:', error);
      }
    };
    fetchTransactions();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTransactions, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [authLoading, authRole]);

  // Subscribe to newsletter subscribers from RTDB in real-time
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    const unsubscribe = subscribeToNewsletterSubscribers(
      (subscribers) => {
        if (mounted) setNewsletterSubs(subscribers);
      },
      () => {
        if (mounted) setNewsletterSubs([]);
      },
    );
    return () => { mounted = false; unsubscribe(); };
    /*
    const fetchSubs = async () => {
      try {
        const res = await fetch('https://apex-b46bd-default-rtdb.firebaseio.com/newsletter.json');
        if (!res.ok) return;
        const data = await res.json();
        if (data && !data.error && mounted) {
          const subs = Object.entries(data).map(([id, val]: [string, any]) => ({
            id,
            email: val.email || '',
            subscribedAt: val.subscribedAt || '',
            source: val.source || '',
          }));
          setNewsletterSubs(subs);
        }
      } catch {
        // Newsletter reads may be blocked by RTDB rules — that's OK
      }
    };
    fetchSubs();
    const interval = setInterval(fetchSubs, 30000);
    return () => { mounted = false; clearInterval(interval); };
    */
  }, [authLoading, authRole]);

  // Also load data from server-side API as a reliable fallback
  // The server-side API bypasses RTDB security rules since it uses the Firebase SDK directly
  useEffect(() => {
    if (authLoading || authRole !== 'admin') return;
    let mounted = true;
    const fetchFallback = async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch('/api/admin/data', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.error) return;
        if (mounted) {
          // Always update from API — it's the most reliable source for admin
          if (data.users?.length > 0) setUsers(data.users);
          if (data.assets?.length > 0) setAssets(data.assets);
          if (data.messages?.length > 0) setMessages(data.messages);
          if (data.vaultRequests?.length > 0) setVaultRequests(data.vaultRequests);
          if (data.orders?.length > 0) setOrders(data.orders);
          if (data.shipments?.length > 0) setShipments(data.shipments);
          if (Array.isArray(data.newsletterSubscribers)) setNewsletterSubs(data.newsletterSubscribers);
        }
      } catch {
        // Silent fail — RTDB subscriptions are the secondary source
      }
    };
    // Initial fetch after short delay
    const timer = setTimeout(fetchFallback, 1500);
    // Poll every 30s for fresh data
    const interval = setInterval(fetchFallback, 30000);
    return () => { mounted = false; clearTimeout(timer); clearInterval(interval); };
  }, [authLoading, authRole, user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = (userProfile?.name || user?.displayName || 'Admin').trim().split(/\s+/).filter(Boolean)[0] || 'Admin';

  // Notifications — same behavior as the client dashboard
  const allNotifications = buildAdminNotifications({ users, assets, orders, shipments, vaultRequests, transactions, messages });
  const notifications = allNotifications.filter((n) => !deletedNotificationIds.includes(n.id));
  const unreadNotificationCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length;

  const markNotificationRead = (id: string) => {
    setReadNotificationIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id].slice(-200);
      if (user?.uid) localStorage.setItem(`admin_notification_read_${user.uid}`, JSON.stringify(next));
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    const ids = notifications.map((notification) => notification.id).slice(-200);
    setReadNotificationIds(ids);
    if (user?.uid) localStorage.setItem(`admin_notification_read_${user.uid}`, JSON.stringify(ids));
  };

  const deleteNotifications = (ids: string[]) => {
    setDeletedNotificationIds((current) => {
      const next = [...new Set([...current, ...ids])].slice(-500);
      if (user?.uid) localStorage.setItem(`admin_notification_deleted_${user.uid}`, JSON.stringify(next));
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

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    await logout();
    router.push('/');
  };

  // CRUD handlers — Users (RTDB)
  const openUserModal = (edit: boolean, user?: UserRecord) => {
    setEditMode(edit);
    if (edit && user) { setEditId(user.id); setUserForm({ name: user.name, email: user.email, role: user.role, status: user.status, vaultLocation: user.vaultLocation }); }
    else { setEditId(null); setUserForm({ name: '', email: '', role: 'client', status: 'active', vaultLocation: '' }); }
    setUserModalOpen(true);
  };

  const saveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) { showToast('Name and email required', 'error'); return; }
    try {
      if (editMode && editId) {
        await updateUserRTDB(editId, userForm);
        showToast('User updated', 'success');
      } else {
        showToast('New users must register through the sign-up page', 'info');
        setUserModalOpen(false);
        return;
      }
    } catch {
      showToast('Failed to update user', 'error');
    }
    setUserModalOpen(false);
  };

  const deleteUser = async (id: string) => {
    try {
      await deleteUserRTDB(id);
      showToast('User deleted', 'info');
    } catch {
      showToast('Failed to delete user', 'error');
    }
  };

  // CRUD handlers — Assets (RTDB)
  const openAssetModal = (edit: boolean, asset?: AssetRecord) => {
    setEditMode(edit);
    if (edit && asset) { setEditId(asset.id); setAssetForm({ ref: asset.ref, type: asset.type, weight: String(asset.weight), status: asset.status, vaultLocation: asset.vaultLocation, userId: asset.userId }); }
    else { setEditId(null); setAssetForm({ ref: '', type: 'bar', weight: '', status: 'active', vaultLocation: 'zurich', userId: '' }); }
    setAssetModalOpen(true);
  };

  const saveAsset = async () => {
    if (!assetForm.ref.trim() || !assetForm.weight || parseFloat(assetForm.weight) <= 0) { showToast('Reference and weight required', 'error'); return; }
    const user = users.find(u => u.id === assetForm.userId);
    const ownerName = user ? user.name : 'Unassigned';
    try {
      if (editMode && editId) {
        await updateAssetRTDB(editId, { ref: assetForm.ref, type: assetForm.type, weight: parseFloat(assetForm.weight), status: assetForm.status, vaultLocation: assetForm.vaultLocation, owner: ownerName, userId: assetForm.userId });
        showToast('Asset updated', 'success');
      } else {
        await addAssetRTDB({ ref: assetForm.ref, type: assetForm.type, weight: parseFloat(assetForm.weight), status: assetForm.status, vaultLocation: assetForm.vaultLocation, owner: ownerName, userId: assetForm.userId });
        showToast('Asset created', 'success');
      }
    } catch {
      showToast('Failed to save asset', 'error');
    }
    setAssetModalOpen(false);
  };

  const deleteAsset = async (id: string) => {
    try {
      await deleteAssetRTDB(id);
      showToast('Asset deleted', 'info');
    } catch {
      showToast('Failed to delete asset', 'error');
    }
  };

  const approveVaultRequest = async (id: string) => {
    const request = vaultRequests.find(v => v.id === id);
    if (!request) { showToast('Vault request not found', 'error'); return; }

    try {
      // 1. Mark the vault request as approved
      await updateVaultRequestStatus(id, 'approved');

      // 2. Mint an asset record for the client so their portfolio populates.
      //    The client dashboard derives holdings/value entirely from the
      //    `assets` collection, so without this step the approved vault
      //    never appears in the client's portfolio.
      const refCode = `VLT-${request.location.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      await addAssetRTDB({
        ref: refCode,
        type: 'bar',
        weight: Number(request.quantity) || 0,
        status: 'active',
        vaultLocation: request.location,
        owner: request.userName,
        userId: request.userId,
      });

      showToast('Vault approved & asset allocated to client', 'success');
    } catch {
      // Optimistic local update even if RTDB fails
      setVaultRequests(prev => prev.map(v => v.id === id ? { ...v, status: 'approved' } : v));
      showToast('Vault request approved (local)', 'success');
    }
  };

  const rejectVaultRequest = async (id: string) => {
    try {
      await updateVaultRequestStatus(id, 'rejected');
      showToast('Vault request rejected', 'info');
    } catch {
      setVaultRequests(prev => prev.map(v => v.id === id ? { ...v, status: 'rejected' } : v));
      showToast('Vault request rejected (local)', 'info');
    }
  };

  const deleteVaultRequest = async (id: string) => {
    try {
      await deleteVaultRequestRTDB(id);
      setVaultRequests(prev => prev.filter(v => v.id !== id));
      showToast('Vault request deleted', 'info');
    } catch {
      showToast('Failed to delete vault request', 'error');
    }
  };

  const openMessageDetail = async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setMessageModalOpen(true);
    if (!msg.read) {
      try {
        await markMessageRead(msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
      } catch {
        // Optimistic local update even if RTDB fails
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
      }
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await deleteMessageRTDB(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      showToast('Message deleted', 'info');
    } catch {
      showToast('Failed to delete message', 'error');
    }
  };

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      await updateOrderStatusRTDB(id, status);
      showToast('Order status updated', 'success');
    } catch {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      showToast('Order status updated (local)', 'success');
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await deleteOrderRTDB(id);
      showToast('Order deleted', 'info');
    } catch {
      showToast('Failed to delete order', 'error');
    }
  };

  const approveShipment = async (id: string) => {
    try {
      // Find the shipment to get assetId
      const shipment = shipments.find(s => s.id === id);
      await updateShipmentStatusRTDB(id, 'approved');
      // Update asset status to "in-transit" when shipment is approved
      if (shipment?.assetId) {
        await updateAssetRTDB(shipment.assetId, { status: 'in-transit' });
      }
      showToast('Shipment approved and asset marked in-transit', 'success');
    } catch (err) {
      setShipments(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
      showToast('Shipment approved (local)', 'success');
    }
  };

  const rejectShipment = async (id: string) => {
    try {
      // Find the shipment to get assetId
      const shipment = shipments.find(s => s.id === id);
      await updateShipmentStatusRTDB(id, 'rejected');
      // Revert asset status back to active if shipment is rejected
      if (shipment?.assetId) {
        await updateAssetRTDB(shipment.assetId, { status: 'active' });
      }
      showToast('Shipment rejected and asset status reverted', 'info');
    } catch (err) {
      setShipments(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' } : s));
      showToast('Shipment rejected (local)', 'info');
    }
  };

  const saveVaultRequest = () => {
    if (!vaultFormAdmin.location || !vaultFormAdmin.type || !vaultFormAdmin.userId) { showToast('All fields required', 'error'); return; }
    const user = users.find(u => u.id === vaultFormAdmin.userId);
    const newId = String(Math.max(...vaultRequests.map(v => parseInt(v.id)), 0) + 1);
    setVaultRequests(prev => [...prev, { id: newId, userName: user?.name || 'Unknown', userId: vaultFormAdmin.userId, type: vaultFormAdmin.type, location: vaultFormAdmin.location, status: 'approved', date: new Date().toISOString().split('T')[0] }]);
    setVaultModalOpen(false);
    showToast('Vault created successfully', 'success');
  };

  if (authLoading || transitionLoading) {
    return <DashboardLoader />;
  }

  const totalAssets = assets.reduce((t, a) => t + a.weight, 0);
  const totalValue = Math.round((totalAssets / 31.1035) * goldSpotPrice);
  const unreadCount = messages.filter(m => !m.read).length;
  const pendingVaultCount = vaultRequests.filter(v => v.status === 'pending').length;
  const activeUsersCount = users.filter(u => u.status === 'active').length;
  const approvedVaultCount = vaultRequests.filter(v => v.status === 'approved').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const pendingShipmentsCount = shipments.filter(s => s.status === 'pending').length;

  return (
    <div className="dashboard-scope min-h-screen bg-[#111114]">
      {/* Top nav */}
      <nav className="fixed w-full z-50 bg-[#111114]/95 backdrop-blur-lg border-b border-[#2A2A2E]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-2">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#aLogoGrad)" opacity="0.9" />
                <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#1A1A1E" />
                <circle cx="20" cy="20" r="3" fill="#C9A84C" />
                <defs><linearGradient id="aLogoGrad" x1="4" y1="4" x2="36" y2="36"><stop stopColor="#D4B96A" /><stop offset="1" stopColor="#A68A3E" /></linearGradient></defs>
              </svg>
              <span className="text-base font-bold tracking-[0.1em] text-[#F5F5F5]">APEXSTORAGE</span>
            </a>
            <div ref={headerMenuRef} className="relative flex items-center gap-2 sm:gap-3">

              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setNotificationOpen((open) => !open); setProfileMenuOpen(false); }}
                  className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-[#2A2A2E]/50 text-[#8A8A8E] hover:text-[#C9A84C] hover:border-[#C9A84C]/35 transition-colors flex items-center justify-center"
                  aria-label="Notifications"
                  aria-expanded={notificationOpen}
                >
                  <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M15 17H9m9-5V9a6 6 0 10-12 0v3l-2 3h16l-2-3zm-5 8a2.5 2.5 0 01-4-2" />
                  </svg>
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-[#C9A84C] text-[9px] font-bold text-[#1A1A1E] flex items-center justify-center ring-2 ring-[#111114]">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#1c222e] bg-[#10141D] shadow-2xl">
                    <div className="flex items-center justify-between gap-3 border-b border-[#1c222e] px-4 py-3">
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase">Notifications</p>
                        <p className="mt-1 text-[10px] text-[#5A5A5E]">Recent platform activity</p>
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
                          <p className="mt-1 text-[10px] text-[#5A5A5E]">Platform updates will appear here.</p>
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
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-[#2A2A2E]/50 text-[#8A8A8E] hover:text-[#C9A84C] hover:border-[#C9A84C]/35 transition-colors flex items-center justify-center"
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
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-[#2A2A2E]/50 text-[#8A8A8E] hover:text-[#C9A84C] hover:border-[#C9A84C]/35 transition-colors flex items-center justify-center"
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
                      <p className="truncate text-xs font-semibold text-[#F5F5F5]">{userProfile?.name || 'Admin'}</p>
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

              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-[#B0B0B4] hover:text-[#C9A84C] p-1.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Sidebar type="admin" activeNav={activeNav} onNavChange={setActiveNav} sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenProfile={() => setProfileOpen(true)} onChangePassword={() => setChangePasswordOpen(true)} goldSpotPrice={goldSpotPrice} />

      {/* Modals */}
      <ProfileSettings open={profileOpen} onClose={() => setProfileOpen(false)} onToast={showToast} />
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} email={user?.email || ''} onToast={showToast} />
      <PerformanceChart open={performanceOpen} onClose={() => setPerformanceOpen(false)} priceHistory={priceHistory} labels={priceLabels} currentPrice={goldSpotPrice} />
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      {/* CRUD Modals */}
      {/* User Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setUserModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl p-5">
            <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] mb-4">{editMode ? 'EDIT USER' : 'NEW USER'}</h3>
            <div className="space-y-3">
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Name</label><input type="text" value={userForm.name} onChange={(e) => setUserForm(p => ({ ...p, name: e.target.value }))} className="input-aurum" /></div>
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Email</label><input type="email" value={userForm.email} onChange={(e) => setUserForm(p => ({ ...p, email: e.target.value }))} className="input-aurum" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Role</label><select value={userForm.role} onChange={(e) => setUserForm(p => ({ ...p, role: e.target.value as 'client' | 'admin' }))} className="input-aurum"><option value="client">Client</option><option value="admin">Admin</option></select></div>
                <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Status</label><select value={userForm.status} onChange={(e) => setUserForm(p => ({ ...p, status: e.target.value }))} className="input-aurum"><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></div>
              </div>
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Vault Location</label><input type="text" value={userForm.vaultLocation} onChange={(e) => setUserForm(p => ({ ...p, vaultLocation: e.target.value }))} className="input-aurum" /></div>
              <button onClick={saveUser} className="w-full btn-gold text-xs">{editMode ? 'Update User' : 'Create User'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Modal */}
      {assetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAssetModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl p-5">
            <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] mb-4">{editMode ? 'EDIT ASSET' : 'NEW ASSET'}</h3>
            <div className="space-y-3">
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Reference</label><input type="text" value={assetForm.ref} onChange={(e) => setAssetForm(p => ({ ...p, ref: e.target.value }))} className="input-aurum" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Type</label><select value={assetForm.type} onChange={(e) => setAssetForm(p => ({ ...p, type: e.target.value }))} className="input-aurum"><option value="bar">Bar</option><option value="coin">Coin</option><option value="jewellery">Jewellery</option></select></div>
                <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Weight (g)</label><input type="number" value={assetForm.weight} onChange={(e) => setAssetForm(p => ({ ...p, weight: e.target.value }))} className="input-aurum" min="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Status</label><select value={assetForm.status} onChange={(e) => setAssetForm(p => ({ ...p, status: e.target.value }))} className="input-aurum"><option value="active">Active</option><option value="pending">Pending</option></select></div>
                <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Vault</label><select value={assetForm.vaultLocation} onChange={(e) => setAssetForm(p => ({ ...p, vaultLocation: e.target.value }))} className="input-aurum"><option value="zurich">Zurich</option><option value="singapore">Singapore</option><option value="london">London</option><option value="newyork">New York</option></select></div>
              </div>
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Owner (User ID)</label><select value={assetForm.userId} onChange={(e) => setAssetForm(p => ({ ...p, userId: e.target.value }))} className="input-aurum"><option value="">Select user</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <button onClick={saveAsset} className="w-full btn-gold text-xs">{editMode ? 'Update Asset' : 'Create Asset'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {messageModalOpen && selectedMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMessageModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl p-5">
            <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">MESSAGE</h3><button onClick={() => setMessageModalOpen(false)} className="text-[#8A8A8E] hover:text-[#C9A84C]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <div className="space-y-2 text-xs">
              <p className="text-[#8A8A8E]">From: <span className="text-[#F5F5F5]">{selectedMessage.name}</span> ({selectedMessage.email})</p>
              <p className="text-[#8A8A8E]">Subject: <span className="text-[#C9A84C]">{selectedMessage.subject}</span></p>
              <p className="text-[#8A8A8E]">Date: {selectedMessage.date}</p>
              <div className="mt-2 p-3 bg-[#1b212c] border border-[#212836] rounded text-[#F5F5F5]">{selectedMessage.message}</div>
            </div>
            <button onClick={() => { deleteMessage(selectedMessage.id); setMessageModalOpen(false); }} className="w-full btn-gold-outline text-xs mt-4">Delete Message</button>
          </div>
        </div>
      )}

      {/* Vault Modal */}
      {vaultModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setVaultModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl p-5">
            <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] mb-4">NEW VAULT REQUEST</h3>
            <div className="space-y-3">
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Location</label><select value={vaultFormAdmin.location} onChange={(e) => setVaultFormAdmin(p => ({ ...p, location: e.target.value }))} className="input-aurum"><option value="">Select</option><option value="Zurich">Zurich</option><option value="Singapore">Singapore</option><option value="London">London</option><option value="New York">New York</option></select></div>
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Type</label><select value={vaultFormAdmin.type} onChange={(e) => setVaultFormAdmin(p => ({ ...p, type: e.target.value }))} className="input-aurum"><option value="">Select</option><option value="allocated">Allocated</option><option value="pooled">Pooled</option></select></div>
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">User</label><select value={vaultFormAdmin.userId} onChange={(e) => setVaultFormAdmin(p => ({ ...p, userId: e.target.value }))} className="input-aurum"><option value="">Select</option>{users.filter(u => u.role === 'client').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div><label className="block text-[9px] font-bold tracking-[0.15em] text-[#8A8A8E] uppercase mb-1">Notes</label><textarea value={vaultFormAdmin.notes} onChange={(e) => setVaultFormAdmin(p => ({ ...p, notes: e.target.value }))} className="input-aurum resize-none" rows={2} /></div>
              <button onClick={saveVaultRequest} className="w-full btn-gold text-xs">Create Vault</button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Detail Modal */}
      {vaultDetailOpen && selectedVaultRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setVaultDetailOpen(false)} />
          <div className="relative w-full max-w-md bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl p-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">VAULT REQUEST</h3>
              <button onClick={() => setVaultDetailOpen(false)} className="text-[#8A8A8E] hover:text-[#C9A84C]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#8A8A8E]">User</span><span className="text-[#F5F5F5]">{selectedVaultRequest.userName}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Email</span><span className="text-[#F5F5F5]">{selectedVaultRequest.userEmail}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Location</span><span className="text-[#C9A84C]">{selectedVaultRequest.location}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Storage Type</span><span className="text-[#F5F5F5] capitalize">{selectedVaultRequest.storageType}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Quantity</span><span className="text-[#F5F5F5]">{selectedVaultRequest.quantity}g</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Status</span><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${selectedVaultRequest.status === 'approved' ? 'bg-green-500/10 text-green-500' : selectedVaultRequest.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-[#C9A84C]/20 text-[#C9A84C]'}`}>{selectedVaultRequest.status.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Date</span><span className="text-[#F5F5F5]">{selectedVaultRequest.date}</span></div>
              <div className="border-t border-[#2A2A2E]/50 pt-2 mt-2">
                <p className="text-[#8A8A8E] mb-1 font-bold tracking-wider uppercase text-[9px]">Shipping Address</p>
                <p className="text-[#F5F5F5]">{selectedVaultRequest.shippingAddress}</p>
                <p className="text-[#F5F5F5]">{selectedVaultRequest.city}{selectedVaultRequest.state ? `, ${selectedVaultRequest.state}` : ''} {selectedVaultRequest.postcode}</p>
                <p className="text-[#F5F5F5]">{selectedVaultRequest.country}</p>
              </div>
              {selectedVaultRequest.notes && (
                <div className="border-t border-[#2A2A2E]/50 pt-2 mt-2">
                  <p className="text-[#8A8A8E] mb-1 font-bold tracking-wider uppercase text-[9px]">Notes</p>
                  <p className="text-[#F5F5F5]">{selectedVaultRequest.notes}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              {selectedVaultRequest.status === 'pending' && (
                <>
                  <button onClick={async () => { await approveVaultRequest(selectedVaultRequest.id); setVaultDetailOpen(false); }} className="flex-1 px-3 py-2 bg-green-500/10 text-green-500 rounded text-[10px] font-bold tracking-wider hover:bg-green-500/20">Approve</button>
                  <button onClick={async () => { await rejectVaultRequest(selectedVaultRequest.id); setVaultDetailOpen(false); }} className="flex-1 px-3 py-2 bg-red-500/10 text-red-500 rounded text-[10px] font-bold tracking-wider hover:bg-red-500/20">Reject</button>
                </>
              )}
              <button onClick={async () => { await deleteVaultRequest(selectedVaultRequest.id); setVaultDetailOpen(false); }} className="flex-1 btn-gold-outline text-xs">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {orderDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOrderDetailOpen(false)} />
          <div className="relative w-full max-w-md bg-[#10141d] border border-[#1c222e] rounded-lg shadow-2xl p-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">ORDER DETAIL</h3>
              <button onClick={() => setOrderDetailOpen(false)} className="text-[#8A8A8E] hover:text-[#C9A84C]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#8A8A8E]">User</span><span className="text-[#F5F5F5]">{selectedOrder.userName}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Email</span><span className="text-[#F5F5F5]">{selectedOrder.userEmail}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Type</span><span className="text-[#F5F5F5]">{selectedOrder.type === 'buy' ? 'Buy' : selectedOrder.type === 'sell' ? 'Sell' : selectedOrder.type}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Product</span><span className="text-[#C9A84C] capitalize">{selectedOrder.productType || '—'}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Quantity</span><span className="text-[#F5F5F5]">{selectedOrder.quantityGrams}g ({selectedOrder.quantityOz}oz)</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Estimated Total</span><span className="text-[#F5F5F5]">${(selectedOrder.estimatedTotal || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Vault</span><span className="text-[#F5F5F5] capitalize">{selectedOrder.vault || '—'}</span></div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Status</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${selectedOrder.status === 'completed' ? 'bg-green-500/10 text-green-500' : selectedOrder.status === 'processing' ? 'bg-blue-500/10 text-blue-500' : selectedOrder.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 'bg-[#C9A84C]/20 text-[#C9A84C]'}`}>{selectedOrder.status.toUpperCase()}</span>
              </div>
              <div className="flex justify-between"><span className="text-[#8A8A8E]">Date</span><span className="text-[#F5F5F5]">{selectedOrder.date}</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              {selectedOrder.status === 'pending' && (
                <>
                  <button onClick={async () => { await updateOrderStatus(selectedOrder.id, 'processing'); setSelectedOrder(prev => prev ? { ...prev, status: 'processing' } : null); }} className="flex-1 px-3 py-2 bg-green-500/10 text-green-500 rounded text-[10px] font-bold tracking-wider hover:bg-green-500/20">Process</button>
                  <button onClick={async () => { await updateOrderStatus(selectedOrder.id, 'cancelled'); setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null); }} className="flex-1 px-3 py-2 bg-red-500/10 text-red-500 rounded text-[10px] font-bold tracking-wider hover:bg-red-500/20">Cancel</button>
                </>
              )}
              {selectedOrder.status === 'processing' && (
                <>
                  <button onClick={async () => { await updateOrderStatus(selectedOrder.id, 'completed'); setSelectedOrder(prev => prev ? { ...prev, status: 'completed' } : null); }} className="flex-1 px-3 py-2 bg-green-500/10 text-green-500 rounded text-[10px] font-bold tracking-wider hover:bg-green-500/20">Complete</button>
                  <button onClick={async () => { await updateOrderStatus(selectedOrder.id, 'cancelled'); setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null); }} className="flex-1 px-3 py-2 bg-red-500/10 text-red-500 rounded text-[10px] font-bold tracking-wider hover:bg-red-500/20">Cancel</button>
                </>
              )}
              {selectedOrder.status === 'completed' && (
                <div className="flex-1 px-3 py-2 bg-green-500/10 text-green-500 rounded text-[10px] font-bold tracking-wider text-center">✓ Completed</div>
              )}
              {selectedOrder.status === 'cancelled' && (
                <button onClick={async () => { await deleteOrder(selectedOrder.id); setOrderDetailOpen(false); }} className="flex-1 px-3 py-2 bg-red-500/10 text-red-500 rounded text-[10px] font-bold tracking-wider hover:bg-red-500/20">Delete</button>
              )}
              <button onClick={() => setOrderDetailOpen(false)} className="flex-1 btn-gold-outline text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="pt-16 pb-10 min-h-screen bg-[#111114] lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Greeting Header Card */}
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

          {/* OVERVIEW */}
          {activeNav === 'overview' && (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Overview</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">System Management</h1></div>
              </div>

              {/* Stat Cards — all data from RTDB */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-3">
                  <p className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mb-1">Users</p>
                  <p className="text-lg font-bold text-[#F5F5F5]">{users.length}<span className="text-xs text-[#8A8A8E] ml-1">({activeUsersCount} active)</span></p>
                </div>
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-3">
                  <p className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mb-1">Orders</p>
                  <p className="text-lg font-bold text-[#F5F5F5]">{orders.length}<span className="text-xs text-[#8A8A8E] ml-1">({pendingOrdersCount} pending)</span></p>
                </div>
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-3">
                  <p className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mb-1">Vault Requests</p>
                  <p className="text-lg font-bold text-[#C9A84C]">{vaultRequests.length}<span className="text-xs text-[#8A8A8E] ml-1">({pendingVaultCount} pending)</span></p>
                </div>
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-3">
                  <p className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mb-1">Pending Approvals</p>
                  <p className="text-lg font-bold text-[#F5F5F5]">{pendingShipmentsCount + pendingOrdersCount}<span className="text-xs text-[#8A8A8E] ml-1">({pendingShipmentsCount} shipments)</span></p>
                </div>
              </div>

              {/* Pending Vault Requests */}
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase">Pending Vault Requests</h3>
                  <button onClick={() => setActiveNav('vaults')} className="text-[10px] text-[#C9A84C] hover:underline tracking-wider uppercase">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Location</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Type</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Qty</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Action</th></tr></thead>
                    <tbody>
                      {vaultRequests.filter(v => v.status === 'pending').length === 0 ? (
                        <tr><td colSpan={5} className="py-4 text-center text-[#8A8A8E]">No pending vault requests</td></tr>
                      ) : (
                        vaultRequests.filter(v => v.status === 'pending').slice(0, 5).map(v => (
                          <tr key={v.id} className="border-b border-[#2A2A2E]/30 bg-[#C9A84C]/5">
                            <td className="py-2 text-[#F5F5F5]">{v.userName}</td>
                            <td className="py-2 text-[#C9A84C]">{v.location}</td>
                            <td className="py-2 text-[#F5F5F5] capitalize">{v.storageType}</td>
                            <td className="py-2 text-[#F5F5F5]">{v.quantity}g</td>
                            <td className="py-2 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button onClick={() => approveVaultRequest(v.id)} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold tracking-wider hover:bg-green-500/20">Approve</button>
                                <button onClick={() => rejectVaultRequest(v.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Performance */}
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-[#8A8A8E] tracking-[0.15em] uppercase mb-1.5">Performance</p>
                  <button onClick={() => setPerformanceOpen(true)} className="text-[10px] text-[#C9A84C] hover:underline tracking-wider uppercase">View Chart</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] text-[#8A8A8E] tracking-wider uppercase">1M</p>
                    <p className="text-lg font-bold text-[#F5F5F5]">+2.4%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[#8A8A8E] tracking-wider uppercase">6M</p>
                    <p className="text-lg font-bold text-[#F5F5F5]">+8.7%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[#8A8A8E] tracking-wider uppercase">1Y</p>
                    <p className="text-lg font-bold text-[#C9A84C]">+7.5%</p>
                  </div>
                </div>
              </div>

              {/* Assets by Vault + User Growth */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                  <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-1">Assets by Type</h3>
                  <p className="text-[10px] text-[#8A8A8E] mb-4">Holdings distribution (weight in grams)</p>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative w-40 h-40 shrink-0">
                      <VaultDonut bars={assets.filter(a => a.type === 'bar').reduce((t, a) => t + a.weight, 0)} coins={assets.filter(a => a.type === 'coin').reduce((t, a) => t + a.weight, 0)} jewellery={assets.filter(a => a.type === 'jewellery').reduce((t, a) => t + a.weight, 0)} />
                    </div>
                    <div className="flex flex-col gap-3 w-full">
                      {(() => {
                        const barW = assets.filter(a => a.type === 'bar').reduce((t, a) => t + a.weight, 0);
                        const coinW = assets.filter(a => a.type === 'coin').reduce((t, a) => t + a.weight, 0);
                        const jewW = assets.filter(a => a.type === 'jewellery').reduce((t, a) => t + a.weight, 0);
                        return (
                          <>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background: '#C9A84C'}}></span><span className="text-[11px] text-[#8A8A8E]">Gold Bars</span><span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{barW.toLocaleString()}g</span></div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background: '#38BDF8'}}></span><span className="text-[11px] text-[#8A8A8E]">Gold Coins</span><span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{coinW.toLocaleString()}g</span></div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background: '#A68A3E'}}></span><span className="text-[11px] text-[#8A8A8E]">Jewellery</span><span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{jewW.toLocaleString()}g</span></div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                  <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-1">User Growth</h3>
                  <p className="text-[10px] text-[#8A8A8E] mb-4">New registrations (last 6 months)</p>
                  <div className="h-44">
                    <GrowthBar
                      data={(() => {
                        const now = new Date();
                        const d: number[] = [];
                        for (let i = 5; i >= 0; i--) {
                          const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime();
                          const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
                          d.push(users.filter(u => { const c = u.createdAt ? new Date(u.createdAt).getTime() : 0; return c >= mStart && c < mEnd; }).length);
                        }
                        return d;
                      })()}
                      labels={(() => {
                        const now = new Date();
                        const l: string[] = [];
                        for (let i = 5; i >= 0; i--) {
                          l.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString('en', { month: 'short' }));
                        }
                        return l;
                      })()}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeNav === 'users' && (
            <div>
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Management</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">Users</h1></div>
                <div className="text-xs text-[#8A8A8E]"><span className="text-[#C9A84C] font-bold">{users.length}</span> total</div>
              </div>
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Name</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Email</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Role</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Vault</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Joined</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Actions</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-[#2A2A2E]/30">
                        <td className="py-2 text-[#F5F5F5] font-medium">{u.name}</td>
                        <td className="py-2 text-[#8A8A8E]">{u.email}</td>
                        <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${u.role === 'admin' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-[#2A2A2E] text-[#8A8A8E]'}`}>{u.role}</span></td>
                        <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${u.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{u.status}</span></td>
                        <td className="py-2 text-[#8A8A8E]">{u.vaultLocation || '—'}</td>
                        <td className="py-2 text-[#8A8A8E]">{u.joined || '—'}</td>
                        <td className="py-2 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => openUserModal(true, u)} className="px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded text-[9px] font-bold tracking-wider hover:bg-[#C9A84C]/20">Edit</button>
                            <button onClick={() => deleteUser(u.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <div className="py-8 text-center text-[#8A8A8E] text-xs">No registered users yet. Users will appear here after they sign up.</div>}
              </div>
            </div>
          )}

          {/* ASSETS */}
          {activeNav === 'assets' && (
            <div>
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Management</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">Assets</h1></div>
                <button onClick={() => openAssetModal(false)} className="btn-gold text-xs px-4 py-2">Add Asset</button>
              </div>
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Ref</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Type</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Weight</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Vault</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Owner</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Actions</th></tr></thead>
                  <tbody>
                    {assets.map(a => (
                      <tr key={a.id} className="border-b border-[#2A2A2E]/30">
                        <td className="py-2 font-mono text-[#8A8A8E]">{a.ref}</td>
                        <td className="py-2 text-[#F5F5F5] capitalize">{a.type}</td>
                        <td className="py-2 text-[#F5F5F5]">{a.weight}g</td>
                        <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{a.status}</span></td>
                        <td className="py-2 text-[#8A8A8E]">{a.vaultLocation}</td>
                        <td className="py-2 text-[#8A8A8E]">{a.owner}</td>
                        <td className="py-2 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => openAssetModal(true, a)} className="px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded text-[9px] font-bold tracking-wider hover:bg-[#C9A84C]/20">Edit</button>
                            <button onClick={() => deleteAsset(a.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assets.length === 0 && <div className="py-8 text-center text-[#8A8A8E] text-xs">No assets yet. Add assets to track vault inventory.</div>}
              </div>
            </div>
          )}

          {/* APPROVALS */}
          {activeNav === 'approvals' && (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Management</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">Approvals</h1></div>
                <div className="text-xs text-[#8A8A8E]"><span className="text-[#C9A84C] font-bold">{pendingVaultCount + pendingOrdersCount + pendingShipmentsCount}</span> total pending item{pendingVaultCount + pendingOrdersCount + pendingShipmentsCount !== 1 ? 's' : ''}</div>
              </div>

              {/* A. Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <div><p className="text-[9px] text-[#8A8A8E] tracking-[0.15em] uppercase">Pending Vaults</p><p className="text-lg font-bold text-[#C9A84C]">{pendingVaultCount}</p></div>
                </div>
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <div><p className="text-[9px] text-[#8A8A8E] tracking-[0.15em] uppercase">Pending Orders</p><p className="text-lg font-bold text-[#C9A84C]">{pendingOrdersCount}</p></div>
                </div>
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  </div>
                  <div><p className="text-[9px] text-[#8A8A8E] tracking-[0.15em] uppercase">Pending Shipments</p><p className="text-lg font-bold text-[#C9A84C]">{pendingShipmentsCount}</p></div>
                </div>
              </div>

              {/* B. Pending Vault Requests */}
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Pending Vault Requests</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Location</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Type</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Qty</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Action</th></tr></thead>
                    <tbody>
                      {vaultRequests.filter(v => v.status === 'pending').length === 0 ? (
                        <tr><td colSpan={7} className="py-4 text-center text-[#8A8A8E]">No pending vault requests</td></tr>
                      ) : (
                        vaultRequests.filter(v => v.status === 'pending').map(v => (
                          <tr key={v.id} className="border-b border-[#2A2A2E]/30 bg-[#C9A84C]/5">
                            <td className="py-2 text-[#F5F5F5]">{v.userName}</td>
                            <td className="py-2 text-[#C9A84C]">{v.location}</td>
                            <td className="py-2 text-[#F5F5F5] capitalize">{v.storageType}</td>
                            <td className="py-2 text-[#F5F5F5]">{v.quantity}g</td>
                            <td className="py-2 text-[#8A8A8E]">{v.date}</td>
                            <td className="py-2"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C]">PENDING</span></td>
                            <td className="py-2 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button onClick={() => { setSelectedVaultRequest(v); setVaultDetailOpen(true); }} className="px-2 py-0.5 bg-[#38BDF8]/10 text-[#38BDF8] rounded text-[9px] font-bold tracking-wider hover:bg-[#38BDF8]/20">View</button>
                                <button onClick={() => approveVaultRequest(v.id)} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold tracking-wider hover:bg-green-500/20">Approve</button>
                                <button onClick={() => rejectVaultRequest(v.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* C. Pending Orders */}
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Pending Orders</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Type</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Product</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Qty</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Est. Total</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Vault</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Action</th></tr></thead>
                    <tbody>
                      {orders.filter(o => o.status === 'pending').length === 0 ? (
                        <tr><td colSpan={9} className="py-4 text-center text-[#8A8A8E]">No pending orders</td></tr>
                      ) : (
                        orders.filter(o => o.status === 'pending').map(o => (
                          <tr key={o.id} className="border-b border-[#2A2A2E]/30 bg-[#C9A84C]/5">
                            <td className="py-2 text-[#F5F5F5]">{o.userName}</td>
                            <td className="py-2 text-[#F5F5F5]">{o.type}</td>
                            <td className="py-2 text-[#C9A84C] capitalize">{o.productType || '—'}</td>
                            <td className="py-2 text-[#F5F5F5]">{o.quantityGrams}g</td>
                            <td className="py-2 text-[#F5F5F5]">${(o.estimatedTotal || 0).toLocaleString()}</td>
                            <td className="py-2 text-[#8A8A8E] capitalize">{o.vault || '—'}</td>
                            <td className="py-2 text-[#8A8A8E]">{o.date}</td>
                            <td className="py-2"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C]">PENDING</span></td>
                            <td className="py-2 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button onClick={() => updateOrderStatus(o.id, 'processing')} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold tracking-wider hover:bg-green-500/20">Process</button>
                                <button onClick={() => updateOrderStatus(o.id, 'cancelled')} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* D. Pending Shipments */}
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Pending Shipments</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Asset</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Weight</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Ship To</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Action</th></tr></thead>
                    <tbody>
                      {shipments.filter(s => s.status === 'pending').length === 0 ? (
                        <tr><td colSpan={7} className="py-4 text-center text-[#8A8A8E]">No pending shipment approvals</td></tr>
                      ) : (
                        shipments.filter(s => s.status === 'pending').map(s => (
                          <tr key={s.id} className="border-b border-[#2A2A2E]/30 bg-[#C9A84C]/5">
                            <td className="py-2 text-[#F5F5F5]">{s.userName}</td>
                            <td className="py-2 text-[#C9A84C]">{s.assetRef || s.assetId}</td>
                            <td className="py-2 text-[#F5F5F5]">{s.weight}g</td>
                            <td className="py-2 text-[#8A8A8E]">{s.deliveryCity}, {s.deliveryCountry}</td>
                            <td className="py-2 text-[#8A8A8E]">{s.date}</td>
                            <td className="py-2"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C]">PENDING</span></td>
                            <td className="py-2 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button onClick={() => approveShipment(s.id)} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold tracking-wider hover:bg-green-500/20">Approve</button>
                                <button onClick={() => rejectShipment(s.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* E. Approval History */}
              {(() => {
                const historyVaults = vaultRequests.filter(v => v.status !== 'pending').map(v => ({ type: 'Vault' as const, id: v.id, userName: v.userName, details: `${v.location} · ${v.storageType} · ${v.quantity}g`, status: v.status, date: v.date, deleteFn: () => deleteVaultRequest(v.id) }));
                const historyOrders = orders.filter(o => o.status !== 'pending').map(o => ({ type: 'Order' as const, id: o.id, userName: o.userName, details: `${o.type} · ${o.productType || '—'} · ${o.quantityGrams}g`, status: o.status, date: o.date, deleteFn: () => deleteOrder(o.id) }));
                const historyShipments = shipments.filter(s => s.status !== 'pending').map(s => ({ type: 'Shipment' as const, id: s.id, userName: s.userName, details: `${s.assetRef || s.assetId} · ${s.weight}g → ${s.deliveryCity}`, status: s.status, date: s.date, deleteFn: async () => { try { await deleteShipmentRTDB(s.id); showToast('Shipment deleted', 'info'); } catch { showToast('Failed to delete', 'error'); } } }));
                const allHistory = [...historyVaults, ...historyOrders, ...historyShipments].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                return allHistory.length > 0 ? (
                  <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                    <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Approval History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Type</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Details</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Actions</th></tr></thead>
                        <tbody>
                          {allHistory.map(item => (
                            <tr key={`${item.type}-${item.id}`} className="border-b border-[#2A2A2E]/30">
                              <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.type === 'Vault' ? 'bg-purple-500/10 text-purple-400' : item.type === 'Order' ? 'bg-blue-500/10 text-blue-400' : 'bg-teal-500/10 text-teal-400'}`}>{item.type.toUpperCase()}</span></td>
                              <td className="py-2 text-[#F5F5F5]">{item.userName}</td>
                              <td className="py-2 text-[#8A8A8E] max-w-[200px] truncate">{item.details}</td>
                              <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.status === 'approved' || item.status === 'completed' || item.status === 'shipped' ? 'bg-green-500/10 text-green-500' : item.status === 'processing' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>{item.status.toUpperCase()}</span></td>
                              <td className="py-2 text-[#8A8A8E]">{item.date}</td>
                              <td className="py-2 text-right">
                                <button onClick={item.deleteFn} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* ANALYTICS */}
          {activeNav === 'analytics' && (() => {
            // ── Compute chart data from RTDB records ──
            const barWeight = assets.filter(a => a.type === 'bar').reduce((t, a) => t + a.weight, 0);
            const coinWeight = assets.filter(a => a.type === 'coin').reduce((t, a) => t + a.weight, 0);
            const jewelleryWeight = assets.filter(a => a.type === 'jewellery').reduce((t, a) => t + a.weight, 0);

            // Vault distribution from assets
            const vaultWeights: Record<string, { weight: number; color: string; label: string }> = {
              zurich: { weight: 0, color: '#C9A84C', label: 'Zurich' },
              singapore: { weight: 0, color: '#38BDF8', label: 'Singapore' },
              london: { weight: 0, color: '#34D399', label: 'London' },
              newyork: { weight: 0, color: '#A78BFA', label: 'New York' },
            };
            const locMap: Record<string, string> = { zurich: 'zurich', singapore: 'singapore', london: 'london', newyork: 'newyork', 'new york': 'newyork', 'zurich a': 'zurich', 'singapore b': 'singapore', 'london c': 'london', 'new york d': 'newyork' };
            assets.forEach(a => {
              const key = locMap[a.vaultLocation?.toLowerCase()] || 'zurich';
              if (vaultWeights[key]) vaultWeights[key].weight += a.weight;
            });
            const totalVaultWeight = Object.values(vaultWeights).reduce((t, v) => t + v.weight, 0) || 1;

            // Growth: new sign-ups per month (last 6 months)
            const now = new Date();
            const growthLabels: string[] = [];
            const growthData: number[] = [];
            for (let i = 5; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const monthLabel = d.toLocaleString('en', { month: 'short' });
              growthLabels.push(monthLabel);
              const monthStart = d.getTime();
              const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
              const count = users.filter(u => {
                const created = u.createdAt ? new Date(u.createdAt).getTime() : 0;
                return created >= monthStart && created < monthEnd;
              }).length;
              // Show as percentage growth relative to base
              growthData.push(count);
            }

            // Storage Revenue: estimated from assets weight × 0.02% monthly fee per 100g × gold price
            const monthlyFeeRate = 0.0002; // 0.02% per 100g per month
            const revenueLabels: string[] = [];
            const revenueAmounts: number[] = [];
            for (let i = 5; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              revenueLabels.push(d.toLocaleString('en', { month: 'short' }));
              // Estimate: total asset value × monthly fee rate
              const monthAssets = assets.filter(a => {
                const created = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                return created < new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
              });
              const monthWeight = monthAssets.reduce((t, a) => t + a.weight, 0);
              const monthValue = (monthWeight / 31.1035) * goldSpotPrice;
              revenueAmounts.push(Math.round(monthValue * monthlyFeeRate));
            }

            return (
              <div>
                {/* Section Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                  <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Insights</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">Analytics</h1></div>
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                    <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-1">Assets by Type</h3>
                    <p className="text-[10px] text-[#8A8A8E] mb-4">Holdings distribution (weight in grams)</p>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative w-40 h-40 shrink-0">
                        <VaultDonut bars={barWeight} coins={coinWeight} jewellery={jewelleryWeight} />
                      </div>
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background: '#C9A84C'}}></span><span className="text-[11px] text-[#8A8A8E]">Gold Bars</span><span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{barWeight.toLocaleString()}g</span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background: '#38BDF8'}}></span><span className="text-[11px] text-[#8A8A8E]">Gold Coins</span><span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{coinWeight.toLocaleString()}g</span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background: '#A68A3E'}}></span><span className="text-[11px] text-[#8A8A8E]">Jewellery</span><span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{jewelleryWeight.toLocaleString()}g</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                    <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-1">Vault Distribution</h3>
                    <p className="text-[10px] text-[#8A8A8E] mb-4">Assets across vault locations</p>
                    <div className="flex flex-col gap-3">
                      {Object.values(vaultWeights).map(v => (
                        <div key={v.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{background: v.color}}></span><span className="text-[11px] text-[#8A8A8E]">{v.label}</span></div>
                            <span className="text-[11px] font-bold text-[#F5F5F5]">{v.weight.toLocaleString()}g ({totalVaultWeight > 0 ? Math.round((v.weight / totalVaultWeight) * 100) : 0}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1b212c] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${totalVaultWeight > 0 ? Math.round((v.weight / totalVaultWeight) * 100) : 0}%`, background: v.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6 mt-6">
                  <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                    <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-1">User Growth</h3>
                    <p className="text-[10px] text-[#8A8A8E] mb-4">New registrations (last 6 months)</p>
                    <div className="h-44"><GrowthBar data={growthData} labels={growthLabels} /></div>
                  </div>
                  <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase">Est. Storage Revenue</h3><button onClick={() => setPerformanceOpen(true)} className="text-[10px] text-[#C9A84C] hover:underline uppercase">Gold Chart</button></div>
                    <p className="text-[10px] text-[#8A8A8E] mb-4">Based on 0.02% per 100g monthly fee × asset value</p>
                    <div className="h-40"><StorageFeesChart months={revenueLabels} amounts={revenueAmounts} /></div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* MESSAGES */}
          {activeNav === 'messages' && (
            <div>
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Communications</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">Messages</h1></div>
                <div className="text-xs text-[#8A8A8E]">
                  <span>{unreadCount}</span> unread
                </div>
              </div>
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">From</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Subject</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Actions</th></tr></thead>
                  <tbody>
                    {messages.map(m => (
                      <tr key={m.id} className={`border-b border-[#2A2A2E]/30 ${!m.read ? 'bg-[#C9A84C]/5' : ''}`}>
                        <td className="py-2 text-[#8A8A8E]">{m.date}</td>
                        <td className="py-2 text-[#F5F5F5]">{m.name} ({m.email})</td>
                        <td className="py-2 text-[#F5F5F5]">{m.subject}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${m.read ? 'bg-[#2A2A2E] text-[#8A8A8E]' : 'bg-[#C9A84C]/20 text-[#C9A84C]'}`}>{m.read ? 'Read' : 'Unread'}</span>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => openMessageDetail(m)} className="px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded text-[9px] font-bold tracking-wider hover:bg-[#C9A84C]/20">View</button>
                            <button onClick={() => deleteMessage(m.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {messages.length === 0 && <div className="py-8 text-center text-[#8A8A8E] text-xs">No messages</div>}
              </div>
            </div>
          )}

          {/* VAULTS */}
          {activeNav === 'vaults' && (
            <div>
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Operations</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">Vaults</h1></div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-[#8A8A8E]">
                    <span className="text-[#C9A84C] font-bold">{vaultRequests.filter(v => v.status === 'pending').length}</span> pending
                  </div>
                  <button onClick={() => setVaultModalOpen(true)} className="btn-gold text-xs px-4 py-2">New Vault</button>
                </div>
              </div>
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Email</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Location</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Type</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Qty</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Actions</th></tr></thead>
                  <tbody>
                    {vaultRequests.map(v => (
                      <tr key={v.id} className={`border-b border-[#2A2A2E]/30 ${v.status === 'pending' ? 'bg-[#C9A84C]/5' : ''}`}>
                        <td className="py-2 text-[#F5F5F5] font-medium">{v.userName}</td>
                        <td className="py-2 text-[#8A8A8E]">{v.userEmail}</td>
                        <td className="py-2 text-[#C9A84C]">{v.location}</td>
                        <td className="py-2 text-[#F5F5F5] capitalize">{v.storageType}</td>
                        <td className="py-2 text-[#F5F5F5]">{v.quantity}g</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${v.status === 'approved' ? 'bg-green-500/10 text-green-500' : v.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-[#C9A84C]/20 text-[#C9A84C]'}`}>{v.status}</span>
                        </td>
                        <td className="py-2 text-[#8A8A8E]">{v.date}</td>
                        <td className="py-2 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => { setSelectedVaultRequest(v); setVaultDetailOpen(true); }} className="px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded text-[9px] font-bold tracking-wider hover:bg-[#C9A84C]/20">View</button>
                            {v.status === 'pending' && (
                              <>
                                <button onClick={() => approveVaultRequest(v.id)} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold tracking-wider hover:bg-green-500/20">Approve</button>
                                <button onClick={() => rejectVaultRequest(v.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Reject</button>
                              </>
                            )}
                            <button onClick={() => deleteVaultRequest(v.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vaultRequests.length === 0 && <div className="py-8 text-center text-[#8A8A8E] text-xs">No vault requests yet. Client requests will appear here in real-time.</div>}
              </div>
            </div>
          )}

          {/* ORDERS */}
          {activeNav === 'orders' && (
            <div>
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <div><span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Operations</span><h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">Orders</h1></div>
                <div className="text-xs text-[#8A8A8E]"><span className="text-[#C9A84C] font-bold">{orders.length}</span> total · <span className="text-[#C9A84C] font-bold">{pendingOrdersCount}</span> pending</div>
              </div>

              {/* A. Status Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { key: 'all', label: 'All', count: orders.length },
                  { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
                  { key: 'processing', label: 'Processing', count: orders.filter(o => o.status === 'processing').length },
                  { key: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'completed').length },
                  { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setOrderFilter(tab.key)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors ${orderFilter === tab.key ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30' : 'bg-[#10141d] text-[#8A8A8E] border border-[#1c222e] hover:text-[#F5F5F5]'}`}>
                    {tab.label} <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${orderFilter === tab.key ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-[#1c222e] text-[#8A8A8E]'}`}>{tab.count}</span>
                  </button>
                ))}
              </div>

              {/* Orders Table */}
              <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Type</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Product</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Quantity</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Est. Total</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Vault</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Actions</th></tr></thead>
                  <tbody>
                    {(() => {
                      const filtered = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
                      return filtered.length === 0 ? (
                        <tr><td colSpan={9} className="py-8 text-center text-[#8A8A8E]">{orderFilter === 'all' ? 'No orders yet. Client buy orders will appear here in real-time.' : `No ${orderFilter} orders found.`}</td></tr>
                      ) : (
                        filtered.map(o => (
                          <tr key={o.id} className={`border-b border-[#2A2A2E]/30 ${o.status === 'pending' ? 'bg-[#C9A84C]/5' : ''}`}>
                            <td className="py-2 text-[#F5F5F5] font-medium">{o.userName}</td>
                            <td className="py-2 text-[#F5F5F5]">{o.type}</td>
                            <td className="py-2 text-[#C9A84C] capitalize">{o.productType || '—'}</td>
                            <td className="py-2 text-[#F5F5F5]">{o.quantityGrams}g ({o.quantityOz}oz)</td>
                            <td className="py-2 text-[#F5F5F5]">${(o.estimatedTotal || 0).toLocaleString()}</td>
                            <td className="py-2 text-[#8A8A8E] capitalize">{o.vault || '—'}</td>
                            <td className="py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${o.status === 'completed' ? 'bg-green-500/10 text-green-500' : o.status === 'processing' ? 'bg-blue-500/10 text-blue-500' : o.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 'bg-[#C9A84C]/20 text-[#C9A84C]'}`}>{o.status}</span>
                            </td>
                            <td className="py-2 text-[#8A8A8E]">{o.date}</td>
                            <td className="py-2 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button onClick={() => { setSelectedOrder(o); setOrderDetailOpen(true); }} className="px-2 py-0.5 bg-[#38BDF8]/10 text-[#38BDF8] rounded text-[9px] font-bold tracking-wider hover:bg-[#38BDF8]/20">View</button>
                                {o.status === 'pending' && (
                                  <>
                                    <button onClick={() => updateOrderStatus(o.id, 'processing')} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold tracking-wider hover:bg-green-500/20">Process</button>
                                    <button onClick={() => updateOrderStatus(o.id, 'cancelled')} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Cancel</button>
                                  </>
                                )}
                                {o.status === 'processing' && (
                                  <>
                                    <button onClick={() => updateOrderStatus(o.id, 'completed')} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold tracking-wider hover:bg-green-500/20">Complete</button>
                                    <button onClick={() => updateOrderStatus(o.id, 'cancelled')} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Cancel</button>
                                  </>
                                )}
                                {o.status === 'cancelled' && (
                                  <button onClick={() => deleteOrder(o.id)} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-wider hover:bg-red-500/20">Delete</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Approved Shipments — Mark Shipped */}
              {shipments.filter(s => s.status === 'approved').length > 0 && (
                <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4 mt-6">
                  <h3 className="text-xs font-bold tracking-[0.15em] text-[#F5F5F5] uppercase mb-3">Approved Shipments — Ready to Ship</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">User</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Asset</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Weight</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Ship To</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Date</th><th className="text-left py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Status</th><th className="text-right py-2 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Action</th></tr></thead>
                      <tbody>
                        {shipments.filter(s => s.status === 'approved').map(s => (
                          <tr key={s.id} className="border-b border-[#2A2A2E]/30 bg-green-500/5">
                            <td className="py-2 text-[#F5F5F5]">{s.userName}</td>
                            <td className="py-2 text-[#C9A84C]">{s.assetRef || s.assetId}</td>
                            <td className="py-2 text-[#F5F5F5]">{s.weight}g</td>
                            <td className="py-2 text-[#8A8A8E]">{s.deliveryCity}, {s.deliveryCountry}</td>
                            <td className="py-2 text-[#8A8A8E]">{s.date}</td>
                            <td className="py-2"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-500">APPROVED</span></td>
                            <td className="py-2 text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button onClick={async () => { 
                                  try { 
                                    await updateShipmentStatusRTDB(s.id, 'shipped');
                                    // Also update the asset status to shipped
                                    await updateAssetRTDB(s.assetId, { status: 'shipped' });
                                    showToast('Shipment marked as shipped and asset updated', 'success'); 
                                  } catch (err) { 
                                    setShipments(prev => prev.map(ps => ps.id === s.id ? { ...ps, status: 'shipped' } : ps));
                                    showToast('Shipment marked as shipped (local)', 'success'); 
                                  } 
                                }} className="px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded text-[9px] font-bold tracking-wider hover:bg-[#C9A84C]/20">Mark Shipped</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transactions Section */}
        {activeNav === 'transactions' && (
          <div className="px-4 sm:px-6 lg:px-8 mb-6">
            <div className="bg-[#10141d] border border-[#1c222e] rounded-lg p-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase">Payments</span>
                  <h1 className="text-xl font-bold text-[#F5F5F5] mt-0.5 tracking-tight">All Transactions</h1>
                </div>
                <div className="text-xs text-[#8A8A8E]">
                  <span className="text-[#C9A84C] font-bold">{transactions.length}</span> total transactions
                </div>
              </div>
              <TransactionHistory transactions={transactions} isAdmin={true} />
            </div>
          </div>
        )}

        {/* Newsletter Subscribers */}
        {activeNav === 'newsletter' && (
          <div className="px-4 sm:px-6 lg:px-8 mb-6">
            <div className="bg-[#10141d] border border-[#1c222e] rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold tracking-[0.1em] text-[#F5F5F5]">NEWSLETTER SUBSCRIBERS</h2>
                    <p className="text-xs text-[#8A8A8E] mt-1">{newsletterSubs.length} subscriber{newsletterSubs.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {newsletterSubs.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-10 h-10 mx-auto text-[#2A2A2E] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                    <p className="text-xs text-[#8A8A8E]">No subscribers yet. Newsletter subscriptions from the website footer will appear here.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-[#2A2A2E]/50"><th className="text-left py-2.5 px-4 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Email</th><th className="text-left py-2.5 px-4 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Subscribed At</th><th className="text-left py-2.5 px-4 text-[9px] tracking-[0.15em] text-[#8A8A8E] uppercase">Source</th></tr></thead>
                    <tbody>
                      {newsletterSubs.map(sub => (
                        <tr key={sub.id} className="border-b border-[#2A2A2E]/30 hover:bg-[#1b212c]/50">
                          <td className="py-2.5 px-4 text-[#F5F5F5]">{sub.email}</td>
                          <td className="py-2.5 px-4 text-[#8A8A8E]">{sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td className="py-2.5 px-4"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9A84C]/10 text-[#C9A84C] uppercase">{sub.source || 'website'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardLoader() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15 + 5);
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-scope min-h-screen bg-[#111114] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background ambient gold glow */}
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[#C9A84C]/5 blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      
      <div className="flex flex-col items-center z-10 max-w-xs text-center px-4">
        {/* Animated Gold Logo */}
        <div className="relative mb-8 animate-pulse">
          <svg className="w-16 h-16 drop-shadow-[0_0_15px_rgba(201,168,76,0.3)]" viewBox="0 0 40 40" fill="none">
            <path d="M20 4L4 36h8l8-16 8 16h8L20 4z" fill="url(#loaderLogoGradAdmin)" opacity="0.95" />
            <path d="M20 12l-10 20h4l6-12 6 12h4L20 12z" fill="#111114" />
            <circle cx="20" cy="20" r="3" fill="#C9A84C" />
            <defs>
              <linearGradient id="loaderLogoGradAdmin" x1="4" y1="4" x2="36" y2="36">
                <stop stopColor="#D4B96A" />
                <stop offset="1" stopColor="#A68A3E" />
              </linearGradient>
            </defs>
          </svg>
          {/* Pulsing ring around logo */}
          <div className="absolute inset-0 rounded-full border border-[#C9A84C]/25 animate-ping opacity-40 pointer-events-none" style={{ animationDuration: '2s' }} />
        </div>

        {/* Elegant Spinner */}
        <div className="relative w-12 h-12 mb-6">
          {/* Inner gold spinner */}
          <div className="absolute inset-0 rounded-full border-2 border-[#C9A84C]/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#C9A84C] animate-spin" />
        </div>

        {/* Dynamic loading text */}
        <p className="text-[10px] font-bold tracking-[0.25em] text-[#C9A84C] uppercase mb-1">
          SECURE HANDSHAKE
        </p>
        <p className="text-[9px] font-medium tracking-[0.15em] text-[#8A8A8E] uppercase mb-3 font-mono">
          Retrieving vault data... {Math.min(percent, 100)}%
        </p>

        {/* Slim loading progress bar */}
        <div className="w-40 h-[2px] bg-[#1c222e] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#C9A84C] transition-all duration-300 ease-out" 
            style={{ width: `${Math.min(percent, 100)}%` }} 
          />
        </div>
      </div>
    </div>
  );
}
