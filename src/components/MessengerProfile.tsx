import React, { useState, useEffect } from 'react';
import type { Messenger, Rating } from '../types';
import { TRANSPORT_MODE_LABELS, buildWhatsAppDeepLink } from '../utils/whatsapp';
import { RunnerMap } from './RunnerMap';
import { authClient } from '../lib/auth-client';
import {
  ArrowLeft,
  Star,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  MessageCircle,
  ArrowRight,
  DollarSign,
  Edit3,
  Trash2,
  AlertCircle,
  ExternalLink,
  Lock,
} from 'lucide-react';

interface MessengerProfileProps {
  messengerId: string;
  onBack: () => void;
  onRequestMessenger: (messenger: Messenger) => void;
  onProfileUpdated?: () => void;
}

export const MessengerProfile: React.FC<MessengerProfileProps> = ({
  messengerId,
  onBack,
  onRequestMessenger,
  onProfileUpdated,
}) => {
  const [messenger, setMessenger] = useState<(Messenger & { ratings?: Rating[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editRadius, setEditRadius] = useState<number>(5.0);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const { data: session } = authClient.useSession();

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/messengers/${messengerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessenger(data);
        setEditName(data.name);
        setEditWhatsapp(data.whatsapp_number);
        setEditRadius(data.radius_km);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [messengerId]);

  if (loading || !messenger) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-slate-500">
        Loading runner details...
      </div>
    );
  }

  const transportInfo = TRANSPORT_MODE_LABELS[messenger.transport_mode] || {
    label: messenger.transport_mode,
    icon: '⚡',
    tag: 'Courier',
  };

  // REBAC Check: Is current user the profile owner or admin?
  const currentUserEmail = session?.user?.email?.toLowerCase();
  const isAdmin = currentUserEmail === 'comfort.designszw@gmail.com';
  const isOwner = currentUserEmail && messenger.owner_email && (currentUserEmail === messenger.owner_email.toLowerCase());
  const hasCrudRights = isAdmin || isOwner;

  // Direct WhatsApp negotiation message
  const negotiationMessage = `Hi ${messenger.name}, I am viewing your verified runner profile on WhaRunner. I would like to negotiate runner fees for an errand around ${messenger.area_name}. Are you available today?`;
  const whatsappNegotiationUrl = buildWhatsAppDeepLink(messenger.whatsapp_number, negotiationMessage);

  // Handle Owner CRUD Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCrudRights) return alert('REBAC Denied: You do not own this runner profile.');

    try {
      setIsSaving(true);
      setFeedbackMsg(null);
      const res = await fetch(`/api/messengers/${messenger.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': session?.user?.email || '',
        },
        body: JSON.stringify({
          name: editName.trim(),
          whatsapp_number: editWhatsapp.trim(),
          radius_km: editRadius,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update runner profile');
      }

      setFeedbackMsg('Profile updated successfully!');
      setIsEditing(false);
      await fetchProfile();
      onProfileUpdated?.();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Owner Delete/Deactivate
  const handleDeleteProfile = async () => {
    if (!hasCrudRights) return alert('REBAC Denied: You do not own this runner profile.');
    if (!confirm('Are you sure you want to delete this runner account? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/messengers/${messenger.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': session?.user?.email || '',
        },
      });

      if (res.ok) {
        alert('Runner profile deleted.');
        onProfileUpdated?.();
        onBack();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Runners</span>
        </button>

        {/* REBAC Access Badge */}
        {hasCrudRights ? (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isAdmin ? 'Admin CRUD Mode' : 'Profile Owner (Full CRUD)'}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Public Read Mode</span>
          </span>
        )}
      </div>

      {/* REBAC CRUD Toolbar for Owner / Admin */}
      {hasCrudRights && (
        <div className="bg-linear-to-r from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Relationship-Based Access Control (REBAC)</span>
            </div>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              You have owner authorization to update details, edit operational radius, or remove this runner profile.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100/60 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
            <button
              onClick={handleDeleteProfile}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Form if in editing mode */}
      {isEditing && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 border-2 border-emerald-500 shadow-md space-y-4 animate-fade-in">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-emerald-600" />
            <span>Edit Runner Profile (Owner CRUD)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Phone Number</label>
              <input
                type="text"
                required
                value={editWhatsapp}
                onChange={(e) => setEditWhatsapp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span>Coverage Radius:</span>
              <span className="font-bold text-emerald-700">{editRadius} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="25"
              step="0.5"
              value={editRadius}
              onChange={(e) => setEditRadius(parseFloat(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
            >
              {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

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
              <span>Base: <strong>{messenger.area_name}</strong> (Coverage: ~{messenger.radius_km} km radius)</span>
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

        {/* WhatsApp Negotiation & Errand Order Buttons */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Direct WhatsApp Negotiation */}
          <a
            href={whatsappNegotiationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Negotiate Fee on WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* 2. Order Errand with Runner */}
          <button
            onClick={() => onRequestMessenger(messenger)}
            className="py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>Book & Order Errand</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-500">
          All orders and negotiations are smoothly handed off to WhatsApp. You can negotiate custom fees and timing directly with {messenger.name}.
        </p>
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
