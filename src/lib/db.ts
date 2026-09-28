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

  constructor() {
    super('WhaRunnerDB');
    this.version(1).stores({
      messengers: 'id, name, transport_mode, area_name, is_active',
      queuedOrders: '++localId, synced, createdAt',
      guestOrders: 'orderId, createdAt',
    });
  }
}

export const localDb = new WhaRunnerDexie();

// Helper to cache messengers
export async function cacheMessengers(messengers: Messenger[]) {
  try {
    await localDb.messengers.clear();
    await localDb.messengers.bulkPut(messengers);
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
