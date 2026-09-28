import React, { useState } from 'react';
import type { Messenger, ErrandType, Order } from '../types';
import { formatWhatsAppMessage, buildWhatsAppDeepLink } from '../utils/whatsapp';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { queueOfflineOrder, saveGuestOrderRef } from '../lib/db';
import {
  ArrowLeft,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  WifiOff,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface WhatsAppPreviewProps {
  orderPayload: {
    errand_type: ErrandType;
    orderer_name: string;
    orderer_whatsapp: string;
    parcel_description?: string | null;
    shop_name?: string | null;
    item_list?: string[];
    budget?: number | null;
    product_image_url?: string | null;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    pickup_contact_person?: string | null;
    delivery_address: string;
    delivery_lat: number;
    delivery_lng: number;
    delivery_contact_person?: string | null;
    scheduled_datetime: string;
    proposed_charge: number;
    notes?: string | null;
    messenger_id: string;
  };
  messenger: Messenger;
  onBack: () => void;
  onOrderCreated: (orderId: string) => void;
}


export const WhatsAppPreview: React.FC<WhatsAppPreviewProps> = ({
  orderPayload,
  messenger,
  onBack,
  onOrderCreated,
}) => {
  const isOnline = useOnlineStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generate the exact WhatsApp message
  const exactMessage = formatWhatsAppMessage({
    ...orderPayload,
    messenger_name: messenger.name,
  });

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(exactMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirmAndOpenWhatsApp = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (isOnline) {
        // Send order to Postgres REST API
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });

        if (!response.ok) {
          throw new Error('Failed to create order on server');
        }

        const data = await response.json();
        const createdOrder: Order = data.order;

        // Save reference for guest locally in Dexie
        await saveGuestOrderRef({
          orderId: createdOrder.id,
          messengerId: messenger.id,
          messengerName: messenger.name,
          errandType: createdOrder.errand_type,
          createdAt: new Date().toISOString(),
        });

        // Open WhatsApp deep link
        const waLink = buildWhatsAppDeepLink(messenger.whatsapp_number, exactMessage);
        window.open(waLink, '_blank');

        // Transition to Order Status page
        onOrderCreated(createdOrder.id);
      } else {
        // Offline: queue order in IndexedDB
        const localId = await queueOfflineOrder(
          {
            ...orderPayload,
            counter_charge: null,
            agreed_charge: null,
            shop_name: orderPayload.shop_name || null,
            budget: orderPayload.budget || null,
            product_image_url: orderPayload.product_image_url || null,
            item_list: orderPayload.item_list || [],
            notes: orderPayload.notes || null,
          },
          messenger.whatsapp_number,
          messenger.name,
          exactMessage
        );


        // Pseudo order ID for local status page until synced
        const offlineOrderId = `offline-${localId}`;
        await saveGuestOrderRef({
          orderId: offlineOrderId,
          messengerId: messenger.id,
          messengerName: messenger.name,
          errandType: orderPayload.errand_type,
          createdAt: new Date().toISOString(),
        });

        alert(
          'You are currently offline. Your errand request has been safely queued in your local app storage and will sync automatically with WhatsApp as soon as connectivity is restored!'
        );

        onOrderCreated(offlineOrderId);
      }
    } catch (err: any) {
      console.error('Order creation failed:', err);
      setErrorMsg(err.message || 'Something went wrong submitting your errand.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Edit Details</span>
        </button>

        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          Step 2 of 3: WhatsApp Preview
        </span>
      </div>

      {/* Intro info */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl shrink-0">
            💬
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">WhatsApp Message Preview</h2>
            <p className="text-xs text-slate-500">
              Review the exact formatted message that will open in your WhatsApp chat with{' '}
              <strong className="text-slate-800">{messenger.name}</strong>.
            </p>
          </div>
        </div>

        {/* WhatsApp Chat Simulation Frame */}
        <div className="relative rounded-2xl bg-[#EFEAE2] p-4 border border-slate-300 shadow-inner overflow-hidden">
          {/* Subtle WhatsApp wallpaper doodle effect */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Header of simulated chat */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/10">
            <div className="flex items-center gap-2">
              <img
                src={messenger.photo_url}
                alt={messenger.name}
                className="w-8 h-8 rounded-full object-cover border border-white"
              />
              <div>
                <div className="text-xs font-bold text-slate-900">{messenger.name}</div>
                <div className="text-[10px] text-emerald-700 font-medium">WhatsApp Runner • Zimbabwe</div>
              </div>
            </div>

            <button
              onClick={handleCopyMessage}
              className="text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white px-2.5 py-1 rounded-lg border border-black/10 flex items-center gap-1 transition"
              title="Copy text to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Outgoing Message Bubble (WhatsApp Green Style) */}
          <div className="flex justify-end">
            <div className="max-w-[94%] bg-[#E7FFDB] text-slate-900 rounded-2xl rounded-tr-xs p-3.5 shadow-xs border border-[#C6EDB5] text-xs font-sans whitespace-pre-wrap leading-relaxed select-text">
              {/* Parse bold and italic for realistic WhatsApp visual formatting */}
              {exactMessage.split('\n').map((line, idx) => {
                if (line.startsWith('*') && line.includes(':*')) {
                  const parts = line.split(':*');
                  const title = parts[0].replace(/\*/g, '');
                  const rest = parts.slice(1).join(':*');
                  return (
                    <div key={idx} className="my-0.5">
                      <strong className="text-emerald-950 font-bold">{title}:</strong>
                      <span className="text-slate-800 ml-1">{rest}</span>
                    </div>
                  );
                } else if (line.startsWith('*') && line.endsWith('*')) {
                  return (
                    <div key={idx} className="font-extrabold text-emerald-950 text-sm mb-1">
                      {line.replace(/\*/g, '')}
                    </div>
                  );
                } else if (line.startsWith('_') && line.endsWith('_')) {
                  return (
                    <div key={idx} className="italic text-slate-700 mt-2 pt-2 border-t border-[#D0F0C0]">
                      {line.replace(/_/g, '')}
                    </div>
                  );
                }
                return <div key={idx}>{line}</div>;
              })}

              <div className="text-[10px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1">
                <span>Just now</span>
                <span className="text-[#34B7F1] font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* If product image was attached */}
        {orderPayload.product_image_url && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
            <img
              src={orderPayload.product_image_url}
              alt="Item photo"
              className="w-12 h-12 rounded-lg object-cover border border-slate-200"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 block">Item / List Photo Attached</span>
              <span className="text-slate-500">
                You can also share this photo directly in WhatsApp when the chat opens.
              </span>
            </div>
          </div>
        )}

        {/* Offline notification if offline */}
        {!isOnline && (
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Offline Notice:</strong> You are currently disconnected. When you tap below, your order will be queued in your local device database. As soon as you are reconnected, it will automatically sync and launch WhatsApp!
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Button: Confirm & Open WhatsApp */}
        <div className="pt-3 space-y-3">
          <button
            onClick={handleConfirmAndOpenWhatsApp}
            disabled={isSubmitting}
            className="w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition cursor-pointer"
          >
            <MessageCircle className="w-5 h-5 fill-white" />
            <span>
              {isSubmitting
                ? 'Saving Errand...'
                : 'Request a Messenger on WhatsApp'}
            </span>
            <ExternalLink className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-center text-slate-500 leading-normal">
            Tapping will save your order to WhaRunner, open WhatsApp with your pre-filled message, and generate your persistent order tracking link.
          </p>
        </div>
      </div>
    </div>
  );
};
