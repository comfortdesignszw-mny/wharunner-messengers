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
  CheckCircle2,
  ChevronDown,
  LogOut,
} from 'lucide-react';


export default function App() {
  const isOnline = useOnlineStatus();
  const { data: session } = authClient.useSession();

  // Cached user profile for instantaneous, zero-flicker UI and offline persistence
  const [cachedUser, setCachedUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('wharunner_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const currentUser = session?.user || cachedUser;

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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('wharunner_user_is_admin') === 'true';
  });

  // New user runner creation prompt modal
  const [showNewUserRunnerPrompt, setShowNewUserRunnerPrompt] = useState(false);
  const [registeredUserName, setRegisteredUserName] = useState('');

  // Synchronize session user with local cache
  useEffect(() => {
    if (session?.user) {
      setCachedUser(session.user);
      localStorage.setItem('wharunner_auth_user', JSON.stringify(session.user));
    }
  }, [session?.user]);

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

  useEffect(() => {
    const syncAdminStatus = async () => {
      const user = session?.user || cachedUser;
      const email = user?.email?.toLowerCase();
      if (!user) {
        setIsAdmin(false);
        localStorage.removeItem('wharunner_user_is_admin');
        return;
      }

      if (email === 'comfort.designszw@gmail.com') {
        setIsAdmin(true);
        localStorage.setItem('wharunner_user_is_admin', 'true');
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'x-user-email': user.email || '' },
        });
        if (res.ok) {
          const data = await res.json();
          const admin = Boolean(
            data?.isAdmin ||
            data?.user?.role === 'admin' ||
            email === 'comfort.designszw@gmail.com'
          );
          setIsAdmin(admin);
          localStorage.setItem('wharunner_user_is_admin', admin ? 'true' : 'false');
        }
      } catch (e) {}
    };
    syncAdminStatus();
  }, [session?.user, cachedUser]);

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

          {/* Quick Header Actions: My Errands + PWA + Better Auth Button in Top Right Corner */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMyOrdersModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              title="View your saved guest errands on this device"
            >
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">My Errands</span>
            </button>

            <PWAInstallButton compact={true} />

            {/* Admin Desk Quick Access for Comfort Admin */}
            {isAdmin && (
              <button
                onClick={() => setCurrentView('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition shadow-xs cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                }`}
                title="Admin Dashboard & KYC Desk"
              >
                <span>👑</span>
                <span className="hidden sm:inline">Admin Desk</span>
              </button>
            )}

            {/* Authenticated User: Sign In button disappears, authenticated user's profile avatar is displayed! */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border border-slate-200 hover:border-emerald-500 bg-white hover:bg-slate-50 transition shadow-xs cursor-pointer select-none group"
                  title="Account Profile & Options"
                >
                  <div className="relative">
                    {currentUser.image ? (
                      <img
                        src={currentUser.image}
                        alt={currentUser.name || 'User'}
                        className="w-8 h-8 rounded-full object-cover border border-emerald-500 shadow-2xs"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                        {currentUser.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-600/30" />
                  </div>

                  <span className="text-xs font-extrabold text-slate-800 max-w-[85px] sm:max-w-[120px] truncate leading-tight">
                    {currentUser.name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition" />
                </button>

                {/* Popover / Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in text-xs">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
                      {currentUser.image ? (
                        <img
                          src={currentUser.image}
                          alt={currentUser.name || 'User'}
                          className="w-10 h-10 rounded-full object-cover border border-emerald-500"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-sm font-black">
                          {currentUser.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 truncate">
                          {currentUser.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {currentUser.email}
                        </div>
                        <div className="mt-1">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                              👑 Super Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                              Active Member
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="py-1">
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setCurrentView('admin');
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-amber-50 text-amber-950 font-bold flex items-center gap-2 transition cursor-pointer"
                        >
                          <span className="text-sm">👑</span>
                          <span>Admin Console & KYC Desk</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setCurrentView('messenger-dashboard');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <Bike className="w-4 h-4 text-emerald-600" />
                        <span>Runner Hub & Deliveries</span>
                      </button>

                      <button
                        onClick={() => {
                          setCurrentView('onboarding');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 text-emerald-600" />
                        <span>+ Register as Runner</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowMyOrdersModal(true);
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <Package className="w-4 h-4 text-emerald-600" />
                        <span>My Saved Errands</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowAuthModal(true);
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>Account Details</span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        onClick={async () => {
                          setShowUserMenu(false);
                          try {
                            await authClient.signOut();
                          } catch (e) {}
                          setCachedUser(null);
                          setIsAdmin(false);
                          localStorage.removeItem('wharunner_auth_user');
                          localStorage.removeItem('wharunner_authenticated_user');
                          localStorage.removeItem('wharunner_user_email');
                          localStorage.removeItem('wharunner_user_is_admin');
                          setCurrentView('browse');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-700 font-bold flex items-center gap-2 transition cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Unauthenticated User: Show Sign In button */
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                title="Sign in or register"
              >
                <KeyRound className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
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

        {/* Screen 6: Messenger Dashboard & Integrated Admin Console */}
        {currentView === 'messenger-dashboard' && (
          <MessengerDashboard
            currentMessenger={activeMessengerForDashboard || messengers[0] || null}
            allMessengers={messengers}
            onSwitchMessenger={(m) => setActiveMessengerForDashboard(m)}
            onViewPublicProfile={handleViewProfile}
            onGoToOnboarding={() => setCurrentView('onboarding')}
            onRefreshMessengers={loadMessengers}
          />
        )}

        {/* Screen 7: Messenger Public Profile */}
        {currentView === 'profile' && selectedMessenger && (
          <MessengerProfile
            messengerId={selectedMessenger.id}
            onBack={() => setCurrentView('browse')}
            onRequestMessenger={handleSelectMessenger}
            onProfileUpdated={loadMessengers}
          />
        )}

        {/* Screen 8: Dedicated Admin Console & KYC Desk */}
        {currentView === 'admin' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentView('browse')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                ← Back to Runners
              </button>
              <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 flex items-center gap-1.5">
                <span>👑</span>
                <span>Administrator Console & KYC Desk</span>
              </span>
            </div>
            <AdminDashboard
              messengers={messengers}
              onRefreshMessengers={loadMessengers}
              currentUserEmail={currentUser?.email || 'comfort.designszw@gmail.com'}
            />
          </div>
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
        onAuthSuccess={(details) => {
          loadMessengers();
          if (details?.user) {
            setCachedUser(details.user);
            localStorage.setItem('wharunner_auth_user', JSON.stringify(details.user));
            localStorage.setItem('wharunner_authenticated_user', JSON.stringify(details.user));
            localStorage.setItem('wharunner_user_email', details.user.email || '');
            const email = details.user.email?.toLowerCase();
            const isAdminUser = Boolean(
              details.user.isAdmin ||
              details.user.role === 'admin' ||
              email === 'comfort.designszw@gmail.com'
            );
            setIsAdmin(isAdminUser);
            localStorage.setItem('wharunner_user_is_admin', isAdminUser ? 'true' : 'false');
          }
          if (details?.isNewUser) {
            setRegisteredUserName(details.user?.name || 'Friend');
            setCurrentView('browse');
            setShowNewUserRunnerPrompt(true);
          }
        }}
      />

      {/* New User Encouragement Popup: Prompt to create Runner Profile */}
      {showNewUserRunnerPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center shadow-xs">
              <Bike className="w-7 h-7 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                Welcome to WhaRunner, {registeredUserName || 'Runner'}! 🎉
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your account is ready! Would you like to earn by offering errands or deliveries across Zimbabwe?
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-left text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Get verified & start receiving orders</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Complete your runner profile in the <strong>+Register</strong> section. Your signed-in info will be auto-populated!
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  setShowNewUserRunnerPrompt(false);
                  setCurrentView('onboarding');
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                + Create Runner Profile
              </button>
              <button
                onClick={() => setShowNewUserRunnerPrompt(false)}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Browse Runners First
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation Bar - Pure Light Theme */}
      <div className="fixed bottom-4 sm:bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-3">
        <nav className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-full bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_36px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/60 transition-all">
          {/* 1. Find Runners */}
          <button
            onClick={() => {
              setCurrentView('browse');
              window.history.pushState({}, '', window.location.pathname);
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              currentView === 'browse'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
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
            className={`px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              currentView === 'request' || currentView === 'preview'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
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
            className={`px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              currentView === 'messenger-dashboard'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Bike className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Runner Hub</span>
          </button>

          {/* 4. Join as Runner */}
          <button
            onClick={() => setCurrentView('onboarding')}
            className={`px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              currentView === 'onboarding'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Register</span>
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
