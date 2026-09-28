import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { localDb } from '../lib/db';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const checkQueued = async () => {
      try {
        const count = await localDb.queuedOrders.where('synced').equals(0).count();
        setQueuedCount(count);
      } catch (e) {
        // ignore
      }
    };

    checkQueued();
    const interval = setInterval(checkQueued, 3000);
    return () => clearInterval(interval);
  }, []);

  // When coming back online, auto-sync queued orders
  useEffect(() => {
    if (isOnline && queuedCount > 0) {
      const syncPending = async () => {
        try {
          const pending = await localDb.queuedOrders.where('synced').equals(0).toArray();
          for (const item of pending) {
            if (!item.localId) continue;
            try {
              const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.orderData),
              });
              if (res.ok) {
                const data = await res.json();
                await localDb.queuedOrders.update(item.localId, {
                  synced: 1,
                  serverOrderId: data.order.id,
                });
                setJustSynced(true);
                setTimeout(() => setJustSynced(false), 5000);

                // Open wa.me link now that the order sync succeeded!
                const cleanPhone = item.messengerWhatsapp.replace(/[^0-9]/g, '');
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(item.formattedMessage)}`;
                window.open(waUrl, '_blank');
              }
            } catch (err) {
              console.error('Failed to sync item:', err);
            }
          }
          const remaining = await localDb.queuedOrders.where('synced').equals(0).count();
          setQueuedCount(remaining);
        } catch (e) {
          console.error('Sync error:', e);
        }
      };

      syncPending();
    }
  }, [isOnline, queuedCount]);

  if (isOnline && queuedCount === 0 && !justSynced) return null;

  if (justSynced) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xl animate-bounce">
        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
        <span>Offline errand queued earlier synced & WhatsApp opened!</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-xl border border-amber-500/50 backdrop-blur-xs">
        <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
        <span>
          Offline Mode — Showing cached Zimbabwe runners.
          {queuedCount > 0 && ` (${queuedCount} errand${queuedCount > 1 ? 's' : ''} queued to sync)`}
        </span>
      </div>
    );
  }

  if (queuedCount > 0) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-xl">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-200" />
        <span>Syncing {queuedCount} offline errand{queuedCount > 1 ? 's' : ''}...</span>
      </div>
    );
  }

  return null;
};
