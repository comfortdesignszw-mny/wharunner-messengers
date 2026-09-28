import React, { useEffect, useState } from 'react';
import { getGuestOrderRefs, type GuestOrderRef } from '../lib/db';
import { X, Package, ArrowRight, ExternalLink } from 'lucide-react';

interface GuestOrdersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

export const GuestOrdersListModal: React.FC<GuestOrdersListModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const [refs, setRefs] = useState<GuestOrderRef[]>([]);

  useEffect(() => {
    if (isOpen) {
      getGuestOrderRefs().then(setRefs);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">My Saved Errands</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {refs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No saved errands found on this device yet. Request a runner to track your errands!
            </div>
          ) : (
            refs.map((ref) => (
              <div
                key={ref.orderId}
                onClick={() => {
                  onSelectOrder(ref.orderId);
                  onClose();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-slate-800 text-xs">
                    {ref.errandType.replace('_', ' ').toUpperCase()} • {ref.messengerName}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Order ID: #{ref.orderId.slice(-8)} • {new Date(ref.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition transform group-hover:translate-x-1" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
