import React, { useState, useEffect } from 'react';
import type { Messenger, Rating } from '../types';
import { TRANSPORT_MODE_LABELS } from '../utils/whatsapp';
import { RunnerMap } from './RunnerMap';
import {
  ArrowLeft,
  Star,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Calendar,
  MessageCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface MessengerProfileProps {
  messengerId: string;
  onBack: () => void;
  onRequestMessenger: (messenger: Messenger) => void;
}

export const MessengerProfile: React.FC<MessengerProfileProps> = ({
  messengerId,
  onBack,
  onRequestMessenger,
}) => {
  const [messenger, setMessenger] = useState<(Messenger & { ratings?: Rating[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/messengers/${messengerId}`);
        if (res.ok) {
          const data = await res.json();
          setMessenger(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [messengerId]);

  if (loading || !messenger) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-slate-500">
        Loading runner profile...
      </div>
    );
  }

  const transportInfo = TRANSPORT_MODE_LABELS[messenger.transport_mode] || {
    label: messenger.transport_mode,
    icon: '⚡',
    tag: 'Courier',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to All Runners</span>
      </button>

      {/* Hero Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <img
            src={messenger.photo_url}
            alt={messenger.name}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-white shadow-lg ring-2 ring-emerald-500/20 shrink-0"
          />

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-black text-slate-900">{messenger.name}</h1>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
              <span className="flex items-center text-amber-500 font-extrabold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <Star className="w-4 h-4 fill-amber-400 mr-1" />
                {messenger.rating_avg.toFixed(1)} ({messenger.rating_count} reviews)
              </span>

              <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200">
                {transportInfo.icon} {transportInfo.label}
              </span>
            </div>

            <p className="text-xs text-slate-600 flex items-center justify-center sm:justify-start gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Base: <strong>{messenger.area_name}</strong> (Coverage: {messenger.radius_km} km radius)</span>
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-center">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="text-xl font-black text-slate-900">{messenger.errands_completed}</div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Completed Errands</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="text-xl font-black text-emerald-700">
              {Math.min(100, Math.round((messenger.errands_completed / (messenger.errands_completed + 1)) * 100))}%
            </div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Acceptance Rate</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="text-xl font-black text-blue-600">&lt; 3m</div>
            <div className="text-[10px] uppercase font-bold text-slate-400">WhatsApp Response</div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-2">
          <button
            onClick={() => onRequestMessenger(messenger)}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>Request {messenger.name.split(' ')[0]} on WhatsApp</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Coverage Map */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span>Operational Service Area</span>
        </h3>
        <p className="text-xs text-slate-500">
          {messenger.name} serves within a {messenger.radius_km} km circle around {messenger.area_name}.
        </p>

        <RunnerMap
          messengers={[]}
          center={[messenger.centre_lat, messenger.centre_lng]}
          zoom={13}
          height="280px"
          singleRadius={{
            lat: messenger.centre_lat,
            lng: messenger.centre_lng,
            radiusKm: messenger.radius_km,
            name: messenger.area_name,
          }}
        />
      </div>

      {/* Customer Ratings / Reviews */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>Customer Reviews</span>
          </h3>
          <span className="text-xs text-slate-500">
            ★{messenger.rating_avg.toFixed(1)} average
          </span>
        </div>

        {messenger.ratings && messenger.ratings.length > 0 ? (
          <div className="divide-y divide-slate-100 space-y-3">
            {messenger.ratings.map((r) => (
              <div key={r.id} className="pt-3 first:pt-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="flex text-amber-400">
                    {Array.from({ length: r.stars }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 ml-2">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && (
                  <p className="text-xs text-slate-700 italic">"{r.comment}"</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500">
            No text reviews written yet. Completed errands are rated ★5.0.
          </div>
        )}
      </div>
    </div>
  );
};
