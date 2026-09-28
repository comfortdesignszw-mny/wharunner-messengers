import React, { useState, useEffect } from 'react';
import type { Messenger, ErrandType, Order } from './types';
import { cacheMessengers, getCachedMessengers } from './lib/db';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { authClient } from './lib/auth-client';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BrowseMessengers } from './components/BrowseMessengers';
import { NewErrandRequest } from './components/NewErrandRequest';
import { WhatsAppPreview } from './components/WhatsAppPreview';
import { OrderStatusPage } from './components/OrderStatusPage';
import { MessengerDashboard } from './components/MessengerDashboard';
import { MessengerOnboarding } from './components/MessengerOnboarding';
import { MessengerProfile } from './components/MessengerProfile';
import { AdminDashboard } from './components/AdminDashboard';
import { GuestOrdersListModal } from './components/GuestOrdersListModal';
import { AuthModal } from './components/AuthModal';
import {
  ShoppingBag,
  Bike,
  ShieldCheck,
  UserPlus,
  Package,
  Layers,
  MapPin,
  KeyRound,
  User,
} from 'lucide-react';


export default function App() {
  const isOnline = useOnlineStatus();
  const { data: session } = authClient.useSession();

  // Navigation states: 'browse' | 'request' | 'preview' | 'status' | 'profile' | 'messenger-dashboard' | 'onboarding' | 'admin'
  const [currentView, setCurrentView] = useState<string>('browse');

  // Messengers state
  const [messengers, setMessengers] = useState<Messenger[]>([]);
  const [isLoadingMessengers, setIsLoadingMessengers] = useState(true);

  // Selected messenger for request / profile
  const [selectedMessenger, setSelectedMessenger] = useState<Messenger | null>(null);

  // Active messenger for dashboard
  const [activeMessengerForDashboard, setActiveMessengerForDashboard] = useState<Messenger | null>(null);

  // Order payload currently in flight (between request and preview)
  const [pendingOrderPayload, setPendingOrderPayload] = useState<any | null>(null);

  // Active order ID for status tracking
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // My saved guest errands modal
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);

  // Better Auth modal
  const [showAuthModal, setShowAuthModal] = useState(false);


  // Load messengers (online fetch + fallback to Dexie cache)
  const loadMessengers = async () => {
    try {
      if (isOnline) {
        const res = await fetch('/api/messengers');
        if (res.ok) {
          const data = await res.json();
          setMessengers(data);
          // Cache in IndexedDB for offline-first browsing
          await cacheMessengers(data);
          if (data.length > 0 && !activeMessengerForDashboard) {
            setActiveMessengerForDashboard(data[0]);
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Network fetch error, loading from local Dexie:', e);
    }

    // Offline or network error: load from Dexie IndexedDB
    const cached = await getCachedMessengers();
    if (cached.length > 0) {
      setMessengers(cached);
      if (!activeMessengerForDashboard) {
        setActiveMessengerForDashboard(cached[0]);
      }
    }
  };

  useEffect(() => {
    loadMessengers().finally(() => setIsLoadingMessengers(false));

    // Check if URL has ?order_id=...
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get('order_id');
    if (orderIdParam) {
      setActiveOrderId(orderIdParam);
      setCurrentView('status');
    }
  }, [isOnline]);

  // Handle Messenger selection for errand
  const handleSelectMessenger = (m: Messenger) => {
    setSelectedMessenger(m);
    setCurrentView('request');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle viewing public profile
  const handleViewProfile = (m: Messenger) => {
    setSelectedMessenger(m);
    setCurrentView('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle transition from Request Form to WhatsApp Preview
  const handleOrderPreview = (payload: any) => {
    setPendingOrderPayload(payload);
    setCurrentView('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle order creation complete -> open Status Page
  const handleOrderCreated = (orderId: string) => {
    setActiveOrderId(orderId);
    setCurrentView('status');
    // Update URL param without page reload for bookmarkability
    const newUrl = `${window.location.pathname}?order_id=${orderId}`;
    window.history.pushState({ orderId }, '', newUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Bar - Clean & Minimalist */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => {
              setCurrentView('browse');
              window.history.pushState({}, '', window.location.pathname);
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-emerald-700/20 group-hover:scale-105 transition transform">
              W
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-slate-900 tracking-tight">
                  WhaRunner <span className="text-emerald-600">Messenger</span>
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500 leading-none">
                WhatsApp Errands Network
              </p>
            </div>
          </div>

          {/* Quick Header Actions: Better Auth User Pill + My Errands + PWA */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white text-xs font-semibold text-slate-700 shadow-xs transition"
              title="Better Auth Account & Session"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              {session?.user ? (
                <span className="text-emerald-800 font-bold truncate max-w-[100px]">
                  {session.user.name?.split(' ')[0]}
                </span>
              ) : (
                <span className="hidden sm:inline">Sign In</span>
              )}
            </button>

            <button
              onClick={() => setShowMyOrdersModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              title="View your saved guest errands on this device"
            >
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">My Errands</span>
            </button>

            <PWAInstallButton compact={true} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-28 sm:pb-32">

        {/* Screen 1: Browse Messengers */}
        {currentView === 'browse' && (
          <BrowseMessengers
            messengers={messengers}
            onSelectMessenger={handleSelectMessenger}
            onViewProfile={handleViewProfile}
            isLoading={isLoadingMessengers}
          />
        )}

        {/* Screen 2: New Errand Request Form */}
        {currentView === 'request' && selectedMessenger && (
          <NewErrandRequest
            messenger={selectedMessenger}
            onBack={() => setCurrentView('browse')}
            onPreview={handleOrderPreview}
          />
        )}

        {/* Screen 3: WhatsApp Preview & Handoff */}
        {currentView === 'preview' && selectedMessenger && pendingOrderPayload && (
          <WhatsAppPreview
            orderPayload={pendingOrderPayload}
            messenger={selectedMessenger}
            onBack={() => setCurrentView('request')}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {/* Screen 4: Guest Order Status & Counter-Charge Negotiation */}
        {currentView === 'status' && activeOrderId && (
          <OrderStatusPage
            orderId={activeOrderId}
            onBrowseAgain={() => {
              setCurrentView('browse');
              window.history.pushState({}, '', window.location.pathname);
            }}
          />
        )}

        {/* Screen 5: Messenger Onboarding */}
        {currentView === 'onboarding' && (
          <MessengerOnboarding
            onBack={() => setCurrentView('browse')}
            onRegistered={(newM) => {
              loadMessengers();
              setActiveMessengerForDashboard(newM);
              setCurrentView('messenger-dashboard');
            }}
          />
        )}

        {/* Screen 6: Messenger Dashboard */}
        {currentView === 'messenger-dashboard' && activeMessengerForDashboard && (
          <MessengerDashboard
            currentMessenger={activeMessengerForDashboard}
            allMessengers={messengers}
            onSwitchMessenger={(m) => setActiveMessengerForDashboard(m)}
            onViewPublicProfile={handleViewProfile}
          />
        )}

        {/* Screen 7: Messenger Public Profile */}
        {currentView === 'profile' && selectedMessenger && (
          <MessengerProfile
            messengerId={selectedMessenger.id}
            onBack={() => setCurrentView('browse')}
            onRequestMessenger={handleSelectMessenger}
          />
        )}

        {/* Screen 8: Admin Dashboard */}
        {currentView === 'admin' && (
          <AdminDashboard
            messengers={messengers}
            onRefreshMessengers={loadMessengers}
          />
        )}
      </main>

      {/* Guest Orders Modal */}
      <GuestOrdersListModal
        isOpen={showMyOrdersModal}
        onClose={() => setShowMyOrdersModal(false)}
        onSelectOrder={(ordId) => {
          setActiveOrderId(ordId);
          setCurrentView('status');
          const newUrl = `${window.location.pathname}?order_id=${ordId}`;
          window.history.pushState({ ordId }, '', newUrl);
        }}
      />

      {/* Better Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => {
          loadMessengers();
        }}
      />

      {/* Floating Bottom Navigation Bar with Glassmorphism */}
      <div className="fixed bottom-4 sm:bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-3">
        <nav className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-full bg-white/80 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.16)] ring-1 ring-slate-900/5 transition-all">
          {/* 1. Find Runners */}
          <button
            onClick={() => {
              setCurrentView('browse');
              window.history.pushState({}, '', window.location.pathname);
            }}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              currentView === 'browse'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Runners</span>
          </button>

          {/* 2. Order an Errand */}
          <button
            onClick={() => {
              if (messengers.length > 0 && !selectedMessenger) {
                setSelectedMessenger(messengers[0]);
              }
              setCurrentView(selectedMessenger || messengers[0] ? 'request' : 'browse');
            }}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              currentView === 'request' || currentView === 'preview'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Order Errand</span>
          </button>

          {/* 3. Runner App */}
          <button
            onClick={() => {
              if (messengers.length > 0 && !activeMessengerForDashboard) {
                setActiveMessengerForDashboard(messengers[0]);
              }
              setCurrentView('messenger-dashboard');
            }}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              currentView === 'messenger-dashboard'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Bike className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Runner Hub</span>
          </button>

          {/* 4. Join as Runner */}
          <button
            onClick={() => setCurrentView('onboarding')}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              currentView === 'onboarding'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Register</span>
          </button>

          {/* 5. Admin Desk */}
          <button
            onClick={() => setCurrentView('admin')}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              currentView === 'admin'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Admin</span>
          </button>

          {/* Small Divider */}
          <div className="w-[1px] h-5 bg-slate-300/70 mx-0.5" />

          {/* 6. Better Auth Profile / Sign In */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-3 sm:px-3.5 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
            title="Better Auth Account & Security"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{session?.user ? session.user.name?.split(' ')[0] : 'Auth'}</span>
          </button>
        </nav>
      </div>

      {/* Offline Status & Background Queue Sync Indicator */}
      <OfflineIndicator />


      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500 space-y-2">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">WhaRunner Messenger</span>
            <span>•</span>
            <span>Errands and Messengers for Everyone</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <span className="font-bold text-slate-800">Across All African Land.</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">100% WhatsApp Native Handoff</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
