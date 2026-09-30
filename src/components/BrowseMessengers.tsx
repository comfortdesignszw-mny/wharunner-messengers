import React, { useState } from 'react';
import type { Messenger, TransportMode, ErrandType } from '../types';
import { RunnerMap } from './RunnerMap';
import { TRANSPORT_MODE_LABELS, ERRAND_TYPE_LABELS, buildWhatsAppDeepLink } from '../utils/whatsapp';
import { ALL_ZIM_LOCATIONS_FILTER } from '../utils/cities';
import { authClient } from '../lib/auth-client';
import {
  Star,
  MapPin,
  CheckCircle,
  ShieldCheck,
  Search,
  Filter,
  List,
  Map as MapIcon,
  Phone,
  ArrowRight,
  Truck,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';

interface BrowseMessengersProps {
  messengers: Messenger[];
  onSelectMessenger: (messenger: Messenger) => void;
  onViewProfile: (messenger: Messenger) => void;
  isLoading?: boolean;
}

export const BrowseMessengers: React.FC<BrowseMessengersProps> = ({
  messengers,
  onSelectMessenger,
  onViewProfile,
  isLoading = false,
}) => {
  const { data: session } = authClient.useSession();
  const [selectedArea, setSelectedArea] = useState('All Areas');
  const [customAreaText, setCustomAreaText] = useState('');
  const [selectedTransport, setSelectedTransport] = useState<string>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Filter messengers: Must be active and verified
  const filtered = messengers.filter((m) => {
    if (!m.is_active) return false;
    // Only published, KYC-verified runners appear on the home page
    if (m.is_verified === false) return false;

    if (selectedArea === 'Other (Custom Location)') {
      if (customAreaText.trim()) {
        const matchCustom = m.area_name.toLowerCase().includes(customAreaText.trim().toLowerCase());
        if (!matchCustom) return false;
      }
    } else if (selectedArea !== 'All Areas') {
      const matchArea = m.area_name.toLowerCase().includes(selectedArea.toLowerCase());
      if (!matchArea) return false;
    }


    if (selectedTransport !== 'all' && m.transport_mode !== selectedTransport) {
      return false;
    }

    if (minRating > 0 && m.rating_avg < minRating) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        m.name.toLowerCase().includes(q) ||
        m.area_name.toLowerCase().includes(q) ||
        m.transport_mode.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Hero Banner for Logistics & Errands */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-emerald-950 via-teal-900 to-emerald-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified African Messenger & Errand Network</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
            Errands run fast. Verified runners on WhatsApp.
          </h1>
          <p className="mt-2 text-sm md:text-base text-emerald-100/90 leading-relaxed">
            From hospital visits and pharmacy collections to quotations, intercity bus handoffs, groceries and market produce. Connect directly with KYC-verified local runners.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> KYC Verified National ID & Licenses
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Transparent Local Rates
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Direct WhatsApp Handoff
            </span>
          </div>
        </div>

        {/* Decorative corner icon */}
        <div className="absolute right-4 bottom-2 opacity-10 pointer-events-none text-9xl">
          📦
        </div>
      </div>

      {/* Popular Errand Services Rail */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-2.5">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Services Covered Across Communities</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
            <span className="text-xl">🏥</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">Hospital & Pharmacy</div>
              <div className="text-[10px] text-slate-500 truncate">Medications & Visits</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">Quotations</div>
              <div className="text-[10px] text-slate-500 truncate">Hardware & Wholesale</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
            <span className="text-xl">🤝</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">Elderly Assistance</div>
              <div className="text-[10px] text-slate-500 truncate">Care packages & Visits</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
            <span className="text-xl">🚌</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">Bus Parcel Handoffs</div>
              <div className="text-[10px] text-slate-500 truncate">Roadport & Bus Depots</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by runner name, suburb, or transport mode..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center self-end md:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'list'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List ({filtered.length})</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'map'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map Coverage</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 items-center text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          {/* Area selector */}
          <select
            value={selectedArea}
            onChange={(e) => {
              setSelectedArea(e.target.value);
              if (e.target.value !== 'Other (Custom Location)') {
                setCustomAreaText('');
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 max-w-[190px] sm:max-w-xs truncate"
          >
            {ALL_ZIM_LOCATIONS_FILTER.map((a) => (
              <option key={a} value={a}>
                {a === 'All Areas'
                  ? '📍 All Cities & Towns'
                  : a === 'Other (Custom Location)'
                  ? '✏️ Other (Custom Location)...'
                  : `📍 ${a}`}
              </option>
            ))}
          </select>

          {/* If custom location is selected */}
          {selectedArea === 'Other (Custom Location)' && (
            <input
              type="text"
              autoFocus
              value={customAreaText}
              onChange={(e) => setCustomAreaText(e.target.value)}
              placeholder="Type custom city, town, or area..."
              className="px-3 py-1.5 rounded-lg border border-emerald-500 bg-emerald-50/50 text-slate-800 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-w-[200px]"
            />
          )}

          {/* Transport mode selector */}

          <select
            value={selectedTransport}
            onChange={(e) => setSelectedTransport(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">⚡ Any Transport Mode</option>
            <option value="foot">🏃 Runner (Foot)</option>
            <option value="bicycle">🚲 Bicycle</option>
            <option value="motorbike">🛵 Motorbike</option>
            <option value="car">🚗 Car / Van</option>
            <option value="public/kombi">🚐 Kombi / Public</option>
          </select>

          {/* Rating filter */}
          <select
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value={0}>★ All Ratings</option>
            <option value={4.5}>★ 4.5 & up</option>
            <option value={4.8}>★ 4.8 & up (Top Rated)</option>
          </select>

            {(selectedArea !== 'All Areas' || selectedTransport !== 'all' || minRating > 0 || searchQuery) && (
            <button
              onClick={() => {
                setSelectedArea('All Areas');
                setSelectedTransport('all');
                setMinRating(0);
                setSearchQuery('');
              }}
              className="text-xs text-rose-600 hover:underline font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Map or List */}
      {viewMode === 'map' ? (
        <div className="space-y-4">
          <RunnerMap
            messengers={filtered}
            onSelectMessenger={(m) => onSelectMessenger(m)}
            height="460px"
          />
          <p className="text-xs text-slate-500 text-center">
            Green circles show operational coverage radius. Tap any runner pin to view details or pick them for your errand.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 p-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-3">
                🔍
              </div>
              <h3 className="text-base font-bold text-slate-800">No runners match this filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try switching the area or selecting all transport modes to find available messengers.
              </p>
              <button
                onClick={() => {
                  setSelectedArea('All Areas');
                  setSelectedTransport('all');
                  setMinRating(0);
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                Show All Runners
              </button>
            </div>
          ) : (
            filtered.map((messenger) => {
              const transportInfo = TRANSPORT_MODE_LABELS[messenger.transport_mode] || {
                label: messenger.transport_mode,
                icon: '⚡',
                tag: 'Courier',
              };

              return (
                <div
                  key={messenger.id}
                  className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Avatar + Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="relative shrink-0">
                        <img
                          src={messenger.photo_url}
                          alt={messenger.name}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-600/20 shadow-xs group-hover:scale-105 transition"
                        />
                        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm shadow-xs border border-slate-200">
                          {transportInfo.icon}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-base truncate">
                            {messenger.name}
                          </h3>
                          <span title="Verified Runner">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          </span>
                          {session?.user?.email &&
                            messenger.owner_email &&
                            session.user.email.toLowerCase() === messenger.owner_email.toLowerCase() && (
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-tight">
                                My Profile
                              </span>
                            )}
                          {session?.user?.email === 'comfort.designszw@gmail.com' && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-tight">
                              Admin CRUD
                            </span>
                          )}
                        </div>


                        {/* Rating & Runs */}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center text-amber-500 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                            <span>{messenger.rating_avg.toFixed(1)}</span>
                            <span className="text-slate-400 font-normal ml-1">
                              ({messenger.rating_count})
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            • {messenger.errands_completed} runs completed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transport & Area badge */}
                    <div className="mt-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-semibold">{messenger.area_name}</span>
                        <span className="text-slate-400 ml-auto font-mono text-[11px]">
                          ~{messenger.radius_km}km
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-500 px-1 text-[11px]">
                        <span className="font-medium">Transport:</span>
                        <span className="font-bold text-slate-700">
                          {transportInfo.icon} {transportInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onViewProfile(messenger)}
                        className="px-3 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-center transition cursor-pointer"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={() => onSelectMessenger(messenger)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold text-center flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                      >
                        <span>Pick Runner</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <a
                      href={buildWhatsAppDeepLink(
                        messenger.whatsapp_number,
                        `Hi ${messenger.name}, I would like to negotiate errand fees and check your availability for an errand in ${messenger.area_name}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200 text-xs font-bold text-center flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Negotiate Fee on WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
