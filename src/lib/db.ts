import Dexie, { type Table } from 'dexie';
import type { Messenger, Order } from '../types';

export interface QueuedOrder {
  localId?: number;
  orderData: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'status'> & { id?: string };
  messengerWhatsapp: string;
  messengerName: string;
  formattedMessage: string;
  createdAt: number;
  synced: number; // 0 = false, 1 = true
  serverOrderId?: string;
}

export interface GuestOrderRef {
  orderId: string;
  messengerId: string;
  messengerName: string;
  errandType: string;
  createdAt: string;
}

export class WhaRunnerDexie extends Dexie {
  messengers!: Table<Messenger, string>;
  queuedOrders!: Table<QueuedOrder, number>;
  guestOrders!: Table<GuestOrderRef, string>;
  adminMessengers!: Table<Messenger, string>;
  adminUsers!: Table<any, string>;
  adminOrders!: Table<Order, string>;

  constructor() {
    super('WhaRunnerDB');
    this.version(1).stores({
      messengers: 'id, name, transport_mode, area_name, is_active',
      queuedOrders: '++localId, synced, createdAt',
      guestOrders: 'orderId, createdAt',
    });
    this.version(2).stores({
      messengers: 'id, name, transport_mode, area_name, is_active, is_verified, kyc_status',
      queuedOrders: '++localId, synced, createdAt',
      guestOrders: 'orderId, createdAt',
      adminMessengers: 'id, name, kyc_status, is_verified, area_name',
      adminUsers: 'id, email, role, auth_provider',
      adminOrders: 'id, messenger_id, status, scheduled_datetime',
    });
  }
}

export const localDb = new WhaRunnerDexie();

// Helper to cache messengers
export async function cacheMessengers(messengers: Messenger[]) {
  try {
    await localDb.messengers.clear();
    if (messengers.length > 0) {
      await localDb.messengers.bulkPut(messengers);
    }
  } catch (err) {
    console.warn('Failed to cache messengers locally:', err);
  }
}

// Helper to get cached messengers
export async function getCachedMessengers(): Promise<Messenger[]> {
  try {
    return await localDb.messengers.toArray();
  } catch (err) {
    console.warn('Failed to get cached messengers:', err);
    return [];
  }
}

// Helper to cache all admin messengers (including pending KYC)
export async function cacheAdminMessengers(messengers: Messenger[]) {
  try {
    await localDb.adminMessengers.clear();
    if (messengers.length > 0) {
      await localDb.adminMessengers.bulkPut(messengers);
    }
    localStorage.setItem('wharunner_cached_admin_messengers_count', String(messengers.length));
  } catch (e) {
    console.warn('Failed to cache admin messengers:', e);
  }
}

export async function getCachedAdminMessengers(): Promise<Messenger[]> {
  try {
    return await localDb.adminMessengers.toArray();
  } catch (e) {
    return [];
  }
}

// Helper to cache admin users
export async function cacheAdminUsers(users: any[]) {
  try {
    await localDb.adminUsers.clear();
    if (users.length > 0) {
      await localDb.adminUsers.bulkPut(users);
    }
  } catch (e) {
    console.warn('Failed to cache admin users:', e);
  }
}

export async function getCachedAdminUsers(): Promise<any[]> {
  try {
    return await localDb.adminUsers.toArray();
  } catch (e) {
    return [];
  }
}

// Helper to cache admin orders
export async function cacheAdminOrders(orders: Order[]) {
  try {
    await localDb.adminOrders.clear();
    if (orders.length > 0) {
      await localDb.adminOrders.bulkPut(orders);
    }
  } catch (e) {
    console.warn('Failed to cache admin orders:', e);
  }
}

export async function getCachedAdminOrders(): Promise<Order[]> {
  try {
    return await localDb.adminOrders.toArray();
  } catch (e) {
    return [];
  }
}

// Helper to cache admin stats in localStorage
export async function cacheAdminStats(stats: any) {
  try {
    localStorage.setItem('wharunner_admin_stats', JSON.stringify(stats));
  } catch (e) {}
}

export function getCachedAdminStats(): any | null {
  try {
    const raw = localStorage.getItem('wharunner_admin_stats');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Helper to queue an offline order
export async function queueOfflineOrder(
  orderData: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'status'>,
  messengerWhatsapp: string,
  messengerName: string,
  formattedMessage: string
): Promise<number> {
  const localId = await localDb.queuedOrders.add({
    orderData,
    messengerWhatsapp,
    messengerName,
    formattedMessage,
    createdAt: Date.now(),
    synced: 0,
  });
  return localId;
}

// Record order token in guest list
export async function saveGuestOrderRef(ref: GuestOrderRef) {
  try {
    await localDb.guestOrders.put(ref);
  } catch (e) {
    console.warn('Could not save guest order ref:', e);
  }
}

// Get guest order refs
export async function getGuestOrderRefs(): Promise<GuestOrderRef[]> {
  try {
    return await localDb.guestOrders.orderBy('createdAt').reverse().toArray();
  } catch (e) {
    return [];
  }
}
