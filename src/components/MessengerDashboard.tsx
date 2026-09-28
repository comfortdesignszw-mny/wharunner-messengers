import React, { useState, useEffect } from 'react';
import type { Messenger, Order, MessengerStats } from '../types';
import { ERRAND_TYPE_LABELS, TRANSPORT_MODE_LABELS, buildWhatsAppDeepLink } from '../utils/whatsapp';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Star,
  RotateCw,
  Phone,
  MessageCircle,
  MapPin,
  WifiOff,
  Package,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

interface MessengerDashboardProps {
  currentMessenger: Messenger;
  allMessengers: Messenger[];
  onSwitchMessenger: (messenger: Messenger) => void;
  onViewPublicProfile: (messenger: Messenger) => void;
}

export const MessengerDashboard: React.FC<MessengerDashboardProps> = ({
  currentMessenger,
  allMessengers,
  onSwitchMessenger,
  onViewPublicProfile,
}) => {
  const isOnline = useOnlineStatus();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<MessengerStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Counter charge state per order: { [orderId]: counterChargeString }
  const [counterCharges, setCounterCharges] = useState<Record<string, string>>({});
  const [activeCounterInputId, setActiveCounterInputId] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      // Fetch orders for this messenger
      const [ordersRes, statsRes] = await Promise.all([
        fetch(`/api/messengers/${currentMessenger.id}/orders`),
        fetch(`/api/messengers/${currentMessenger.id}/stats`),
      ]);

      if (ordersRes.ok) {
        const ords = await ordersRes.json();
        setOrders(ords);
      }
      if (statsRes.ok) {
        const st = await statsRes.json();
        setStats(st);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 4000);
    return () => clearInterval(interval);
  }, [currentMessenger.id]);

  // Accept errand
  const handleAccept = async (orderId: string, withCounter = false) => {
    try {
      setProcessingOrderId(orderId);
      const counterVal = withCounter ? counterCharges[orderId] : undefined;

      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counter_charge: counterVal || null }),
      });

      if (res.ok) {
        setActiveCounterInputId(null);
        await fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Reject errand
  const handleReject = async (orderId: string) => {
    if (!confirm('Are you sure you want to decline this errand?')) return;
    try {
      setProcessingOrderId(orderId);
      const res = await fetch(`/api/orders/${orderId}/reject`, {
        method: 'PATCH',
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Progress status update (in_progress, completed)
  const handleUpdateStatus = async (orderId: string, nextStatus: 'in_progress' | 'completed') => {
    try {
      setProcessingOrderId(orderId);
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const pendingOrNegotiatingOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'negotiating'
  );
  const activeOrders = orders.filter(
    (o) => o.status === 'accepted' || o.status === 'in_progress'
  );
  const pastOrders = orders.filter(
    (o) => o.status === 'completed' || o.status === 'rejected' || o.status === 'cancelled'
  );

  return (
    <div className="space-y-6">
      {/* Offline Banner for Messenger */}
      {!isOnline && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Offline Stale-Data Indicator:</strong> You are currently offline. Showing cached errand lists and local metrics. Incoming requests will update once connection is re-established.
          </div>
        </div>
      )}

      {/* Runner Profile Header with Switcher for Testing */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={currentMessenger.photo_url}
            alt={currentMessenger.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-600 shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900">{currentMessenger.name}</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                Active Runner
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span>{TRANSPORT_MODE_LABELS[currentMessenger.transport_mode]?.label}</span>
              <span>•</span>
              <span>{currentMessenger.area_name} (~{currentMessenger.radius_km}km)</span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold">{currentMessenger.whatsapp_number}</span>
            </div>
          </div>
        </div>

        {/* Runner Switcher & Profile View */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={currentMessenger.id}
            onChange={(e) => {
              const found = allMessengers.find((m) => m.id === e.target.value);
              if (found) onSwitchMessenger(found);
            }}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-700"
          >
            {allMessengers.map((m) => (
              <option key={m.id} value={m.id}>
                Switch runner: {m.name} ({m.transport_mode})
              </option>
            ))}
          </select>

          <button
            onClick={() => onViewPublicProfile(currentMessenger)}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition whitespace-nowrap"
          >
            View Public Profile
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Completed Runs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats?.errands_completed ?? currentMessenger.errands_completed}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold">
            {stats?.acceptance_rate ?? 98}% acceptance rate
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Average Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            ★{(stats?.rating_avg ?? currentMessenger.rating_avg).toFixed(1)}
          </div>
          <span className="text-[10px] text-slate-500">
            {stats?.rating_count ?? currentMessenger.rating_count} customer reviews
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Earnings</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            ${(stats?.total_earnings_usd ?? 0).toFixed(2)}{' '}
            <span className="text-xs text-slate-500 font-normal">USD</span>
          </div>
          <span className="text-[10px] text-slate-400">Direct cash/fee logs</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Avg Response Time</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">&lt; 3 mins</div>
          <span className="text-[10px] text-blue-600 font-medium">via WhatsApp deep link</span>
        </div>
      </div>

      {/* SECTION 1: Incoming Errand Requests (Pending & Negotiating) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span>Incoming Requests</span>
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              {pendingOrNegotiatingOrders.length}
            </span>
          </h3>
          <span className="text-xs text-slate-500">Accept or counter-charge in-app</span>
        </div>

        {pendingOrNegotiatingOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs">
            No pending errand requests right now. New requests sent by customers via WhatsApp will appear here!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingOrNegotiatingOrders.map((order) => {
              const isCounterOpen = activeCounterInputId === order.id;
              const errandInfo = ERRAND_TYPE_LABELS[order.errand_type];
              const isProcessing = processingOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-5 border-2 border-emerald-500/40 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {errandInfo?.icon} {errandInfo?.label || order.errand_type}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            order.status === 'negotiating'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        From: <strong className="text-slate-900">{order.orderer_name}</strong> •{' '}
                        <span>{order.orderer_whatsapp}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500">Proposed Fee:</div>
                      <div className="text-xl font-black text-emerald-700">
                        ${order.proposed_charge.toFixed(2)}{' '}
                        <span className="text-xs font-normal text-slate-400">USD</span>
                      </div>
                      {order.counter_charge && (
                        <div className="text-[11px] text-blue-700 font-semibold">
                          Your Counter: ${order.counter_charge.toFixed(2)} USD
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route & Items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">
                          Pickup Location
                        </span>
                        <span className="font-semibold text-slate-800">{order.pickup_address}</span>
                        {order.pickup_contact_person && (
                          <div className="text-[11px] text-emerald-700">
                            Assisted by: <span className="font-semibold">{order.pickup_contact_person}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">
                          Delivery / Drop-off
                        </span>
                        <span className="font-semibold text-slate-800">{order.delivery_address}</span>
                        {order.delivery_contact_person && (
                          <div className="text-[11px] text-emerald-700">
                            Assisted by: <span className="font-semibold">{order.delivery_contact_person}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 pt-1">
                        Time: {order.scheduled_datetime}
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                      {order.parcel_description && (
                        <div className="text-slate-800 bg-white p-2 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-900 block text-[10px] uppercase text-slate-400">Parcel / Items:</span>
                          {order.parcel_description}
                        </div>
                      )}

                      {order.shop_name && (
                        <div className="text-slate-700">
                          <span className="font-bold">Store:</span> {order.shop_name}
                          {order.budget && (
                            <span className="ml-2 text-slate-500">
                              (Est. budget: ${order.budget.toFixed(2)})
                            </span>
                          )}
                        </div>
                      )}


                      {order.item_list && order.item_list.length > 0 && (
                        <div className="text-slate-700">
                          <span className="font-bold">Items:</span>{' '}
                          {order.item_list.join(', ')}
                        </div>
                      )}

                      {order.notes && (
                        <div className="text-slate-600 italic">
                          <span className="font-bold not-italic">Notes:</span> {order.notes}
                        </div>
                      )}

                      {order.product_image_url && (
                        <div className="pt-1">
                          <img
                            src={order.product_image_url}
                            alt="Order item"
                            className="w-12 h-12 rounded-lg object-cover border"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions: Accept (Direct or Counter), Reject */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={buildWhatsAppDeepLink(
                          order.orderer_whatsapp,
                          `Hi ${order.orderer_name}, I saw your errand request #${order.id.slice(-6)} on WhaRunner.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Chat on WhatsApp</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(order.id)}
                        disabled={isProcessing}
                        className="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
                      >
                        Reject
                      </button>

                      <button
                        onClick={() => setActiveCounterInputId(isCounterOpen ? null : order.id)}
                        className="px-4 py-2 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-bold transition"
                      >
                        {isCounterOpen ? 'Cancel Counter' : 'Counter Offer'}
                      </button>

                      <button
                        onClick={() => handleAccept(order.id, false)}
                        disabled={isProcessing}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition"
                      >
                        Accept at ${order.proposed_charge.toFixed(2)}
                      </button>
                    </div>
                  </div>

                  {/* Counter Charge Inline Form */}
                  {isCounterOpen && (
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row items-center gap-3">
                      <span className="text-xs font-bold text-blue-900 shrink-0">
                        Propose Counter Fee ($USD):
                      </span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="e.g. 6.00"
                          value={counterCharges[order.id] || ''}
                          onChange={(e) =>
                            setCounterCharges({
                              ...counterCharges,
                              [order.id]: e.target.value,
                            })
                          }
                          className="w-full pl-6 pr-3 py-1.5 rounded-xl border border-blue-300 bg-white text-xs font-bold"
                        />
                      </div>
                      <button
                        onClick={() => handleAccept(order.id, true)}
                        disabled={!counterCharges[order.id]}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shrink-0"
                      >
                        Send Counter Offer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Active Errands (Accepted & In Progress) */}
      <div className="space-y-4 pt-4">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <span>Active Errands in Progress</span>
          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
            {activeOrders.length}
          </span>
        </h3>

        {activeOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-500 text-xs">
            No active runs right now.
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-3xl p-5 border border-indigo-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      {order.errand_type.toUpperCase()} • {order.orderer_name} ({order.orderer_whatsapp})
                    </span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {order.pickup_address} → {order.delivery_address}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-emerald-700 font-extrabold">
                      ${(order.agreed_charge || order.proposed_charge).toFixed(2)} USD
                    </span>
                    <div className="text-[10px] font-bold uppercase text-indigo-700">
                      {order.status}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <a
                    href={buildWhatsAppDeepLink(
                      order.orderer_whatsapp,
                      `Hi ${order.orderer_name}, update on your errand: `
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-700 font-semibold flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Customer</span>
                  </a>

                  <div className="flex items-center gap-2">
                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                        disabled={processingOrderId === order.id}
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                      >
                        Start Errand (In Progress)
                      </button>
                    )}

                    <button
                      onClick={() => handleUpdateStatus(order.id, 'completed')}
                      disabled={processingOrderId === order.id}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Completed</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: Completed / Past Errands */}
      {pastOrders.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-bold text-slate-600">Past Errand History</h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
            {pastOrders.slice(0, 5).map((o) => (
              <div key={o.id} className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">
                    {o.errand_type} for {o.orderer_name}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {o.pickup_address} → {o.delivery_address}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold ${
                      o.status === 'completed' ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    ${(o.agreed_charge || o.proposed_charge).toFixed(2)} USD
                  </span>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">
                    {o.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
