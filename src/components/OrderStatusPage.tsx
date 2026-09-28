import React, { useState, useEffect } from 'react';
import type { Order, OrderStatus } from '../types';
import { ERRAND_TYPE_LABELS, TRANSPORT_MODE_LABELS, buildWhatsAppDeepLink } from '../utils/whatsapp';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  MessageCircle,
  DollarSign,
  Star,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Package,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

interface OrderStatusPageProps {
  orderId: string;
  onBrowseAgain: () => void;
}

export const OrderStatusPage: React.FC<OrderStatusPageProps> = ({
  orderId,
  onBrowseAgain,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Negotiation state
  const [newProposedCharge, setNewProposedCharge] = useState('');
  const [isSubmittingNegotiation, setIsSubmittingNegotiation] = useState(false);

  // Rating state (when completed)
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const fetchOrder = async () => {
    try {
      if (orderId.startsWith('offline-')) {
        // Offline order mock view
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        throw new Error('Order not found or access token expired');
      }
      const data = await res.json();
      setOrder(data);
      if (data.rating) {
        setRatingSubmitted(true);
      }
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    // Live polling every 4 seconds for guest live status update
    const interval = setInterval(fetchOrder, 4000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Orderer accepts the counter charge from messenger
  const handleAcceptCounterCharge = async () => {
    if (!order) return;
    try {
      setIsSubmittingNegotiation(true);
      const res = await fetch(`/api/orders/${order.id}/counter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) {
        await fetchOrder();
      }
    } catch (err) {
      console.error('Failed to accept counter charge:', err);
    } finally {
      setIsSubmittingNegotiation(false);
    }
  };

  // Orderer proposes a new charge
  const handleProposeNewCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !newProposedCharge) return;

    try {
      setIsSubmittingNegotiation(true);
      const res = await fetch(`/api/orders/${order.id}/counter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose',
          proposed_charge: parseFloat(newProposedCharge),
        }),
      });
      if (res.ok) {
        setNewProposedCharge('');
        await fetchOrder();
      }
    } catch (err) {
      console.error('Failed to propose counter charge:', err);
    } finally {
      setIsSubmittingNegotiation(false);
    }
  };

  // Submit Rating
  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      setIsSubmittingRating(true);
      const res = await fetch(`/api/orders/${order.id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stars,
          comment: comment.trim() || null,
        }),
      });
      if (res.ok) {
        setRatingSubmitted(true);
        await fetchOrder();
      }
    } catch (err) {
      console.error('Rating failed:', err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const copyStatusUrl = () => {
    const url = window.location.origin + window.location.pathname + `?order_id=${orderId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <RotateCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Loading your errand status...</p>
      </div>
    );
  }

  if (orderId.startsWith('offline-')) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-3xl mx-auto">
          ⏳
        </div>
        <h2 className="text-xl font-bold text-slate-900">Errand Queued Offline</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          You are currently offline. Your errand request has been saved in your local device storage. As soon as your internet reconnects, WhaRunner will automatically send it to the runner and open WhatsApp!
        </p>
        <button
          onClick={onBrowseAgain}
          className="mt-4 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          Back to Runners
        </button>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-3xl mx-auto">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
        <p className="text-sm text-slate-500">
          The requested errand order UUID does not exist or was cancelled.
        </p>
        <button
          onClick={onBrowseAgain}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
        >
          Browse Available Runners
        </button>
      </div>
    );
  }

  // Status Badge UI
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          icon: <Clock className="w-4 h-4 text-amber-600 animate-spin" />,
          title: 'Waiting for Runner Response',
          desc: 'Your request was sent via WhatsApp. The runner is reviewing your errand and proposed fee.',
        };
      case 'negotiating':
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-900',
          icon: <AlertTriangle className="w-4 h-4 text-blue-600" />,
          title: 'Fee Counter-Offer Proposed',
          desc: 'The runner suggested a counter-charge for this errand. Review and respond below.',
        };
      case 'accepted':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          title: 'Errand Accepted!',
          desc: `Runner agreed to the errand at $${(order.agreed_charge || order.proposed_charge).toFixed(2)} USD.`,
        };
      case 'in_progress':
        return {
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
          icon: <Package className="w-4 h-4 text-indigo-600 animate-bounce" />,
          title: 'Errand In Progress',
          desc: 'Runner is currently running your errand (shopping or transit).',
        };
      case 'completed':
        return {
          bg: 'bg-teal-50 border-teal-200 text-teal-900',
          icon: <CheckCircle2 className="w-4 h-4 text-teal-600" />,
          title: 'Errand Completed 🎉',
          desc: 'Your errand has been successfully delivered and completed!',
        };
      case 'rejected':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-900',
          icon: <XCircle className="w-4 h-4 text-rose-600" />,
          title: 'Runner Unavailable',
          desc: 'The runner was unable to take this errand right now. You can pick another nearby runner.',
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-800',
          icon: <Clock className="w-4 h-4" />,
          title: status,
          desc: '',
        };
    }
  };

  const statusInfo = getStatusBadge(order.status);
  const errandInfo = ERRAND_TYPE_LABELS[order.errand_type];

  // Direct WhatsApp chat link with runner
  const runnerWhatsappLink = order.messenger_whatsapp
    ? buildWhatsAppDeepLink(
        order.messenger_whatsapp,
        `Hi ${order.messenger_name || 'Runner'}, following up on Errand #${order.id.slice(-6)}: ${order.pickup_address} -> ${order.delivery_address}`
      )
    : '#';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top bar with back and Share / Bookmark status link */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBrowseAgain}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition"
        >
          ← Browse Runners
        </button>

        <button
          onClick={copyStatusUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs transition"
          title="Copy persistent guest link to access status anytime"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Tracking Link Copied!' : 'Copy Tracking Link'}</span>
        </button>
      </div>

      {/* Main Status Hero Card */}
      <div className={`rounded-3xl p-6 border ${statusInfo.bg} shadow-sm space-y-3`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Order #{order.id.slice(-8)}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            {statusInfo.icon}
            <span>{order.status}</span>
          </span>
        </div>

        <div>
          <h2 className="text-xl font-extrabold">{statusInfo.title}</h2>
          <p className="text-xs opacity-90 mt-1 leading-relaxed">{statusInfo.desc}</p>
        </div>

        {/* Live sync pulse */}
        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-black/5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live status auto-refreshing</span>
          </span>
          <span>Created {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Counter-charge Negotiation UI (Core Flow 3) */}
      {order.status === 'negotiating' && order.counter_charge && (
        <div className="bg-white rounded-3xl p-6 border-2 border-blue-500 shadow-lg space-y-4">
          <div className="flex items-center gap-2 text-blue-900">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-base">Counter-Charge Received</h3>
          </div>

          <p className="text-xs text-slate-600">
            Your original proposed fee was{' '}
            <strong className="text-slate-800">${order.proposed_charge.toFixed(2)} USD</strong>.
            The runner has offered to complete this errand for{' '}
            <strong className="text-emerald-700 text-sm font-extrabold">
              ${order.counter_charge.toFixed(2)} USD
            </strong>
            .
          </p>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs text-blue-800 font-semibold">Runner's Counter Offer:</div>
              <div className="text-2xl font-black text-blue-950">
                ${order.counter_charge.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-500">USD</span>
              </div>
            </div>

            <button
              onClick={handleAcceptCounterCharge}
              disabled={isSubmittingNegotiation}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              Accept ${order.counter_charge.toFixed(2)} Counter Charge
            </button>
          </div>

          {/* Or submit new proposal */}
          <form onSubmit={handleProposeNewCharge} className="pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-700 block mb-1.5">
              Or propose a different amount ($USD):
            </span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                <input
                  type="number"
                  step="0.5"
                  required
                  min="1"
                  value={newProposedCharge}
                  onChange={(e) => setNewProposedCharge(e.target.value)}
                  placeholder="e.g. 5.00"
                  className="w-full pl-6 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingNegotiation || !newProposedCharge}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
              >
                Send New Offer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Runner Card & Direct WhatsApp Action */}
      {order.messenger_name && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {order.messenger_photo ? (
              <img
                src={order.messenger_photo}
                alt={order.messenger_name}
                className="w-13 h-13 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-lg shrink-0">
                {order.messenger_name[0]}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-slate-900 text-sm">{order.messenger_name}</h4>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {order.messenger_whatsapp}
              </div>
            </div>
          </div>

          <a
            href={runnerWhatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Chat on WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Errand Summary Details */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Errand Overview
        </h3>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Type:</span>
            <div className="font-bold text-slate-800 text-sm mt-0.5">
              {errandInfo?.icon} {errandInfo?.label || order.errand_type}
            </div>
          </div>

          <div>
            <span className="text-slate-400 font-medium">Agreed / Proposed Fee:</span>
            <div className="font-extrabold text-emerald-700 text-sm mt-0.5">
              ${(order.agreed_charge || order.proposed_charge).toFixed(2)} USD
            </div>
          </div>
        </div>

        {/* Parcel details if provided */}
        {order.parcel_description && (
          <div className="pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Parcel / Items:</span>
            <div className="font-semibold text-slate-800 mt-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              {order.parcel_description}
            </div>
          </div>
        )}

        {/* Route / Addresses & Contacts */}
        <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
            <div className="flex-1">
              <span className="text-slate-400 text-[11px]">Pickup Location:</span>
              <div className="font-semibold text-slate-800">{order.pickup_address}</div>
              {order.pickup_contact_person && (
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  Assisted by: <span className="font-semibold">{order.pickup_contact_person}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0" />
            <div className="flex-1">
              <span className="text-slate-400 text-[11px]">Drop-off Location:</span>
              <div className="font-semibold text-slate-800">{order.delivery_address}</div>
              {order.delivery_contact_person && (
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  Assisted by: <span className="font-semibold">{order.delivery_contact_person}</span>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Item List if provided */}
        {order.item_list && order.item_list.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 block mb-1">
              Items to purchase ({order.item_list.length}):
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {order.item_list.map((it, idx) => (
                <li key={idx}>{it}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
            <span className="font-bold text-slate-700">Notes: </span>
            {order.notes}
          </div>
        )}
      </div>

      {/* Completion Rating Card (Only shown if status is completed) */}
      {order.status === 'completed' && (
        <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500 shadow-md space-y-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
            <h3 className="font-bold text-slate-900 text-base">Rate Your Runner</h3>
          </div>

          {ratingSubmitted ? (
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Thank you! Your rating has been submitted to the runner's profile.</span>
            </div>
          ) : (
            <form onSubmit={handleRatingSubmit} className="space-y-4">
              <p className="text-xs text-slate-500">
                How was the errand service provided by {order.messenger_name}?
              </p>

              {/* Star selector */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStars(s)}
                    className="p-1 hover:scale-125 transition transform"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        s <= stars
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-amber-600 ml-2">
                  {stars} Star{stars > 1 ? 's' : ''}
                </span>
              </div>

              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional review: was the runner on time, communicated clearly, and brought the right items?"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs"
              />

              <button
                type="submit"
                disabled={isSubmittingRating}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
              >
                Submit Rating
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
