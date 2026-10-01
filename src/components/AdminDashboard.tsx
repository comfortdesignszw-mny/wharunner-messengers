import React, { useState, useEffect } from 'react';
import type { Messenger, AdminStats, OrderStatus, Order } from '../types';
import { TRANSPORT_MODE_LABELS, ERRAND_TYPE_LABELS, buildWhatsAppDeepLink } from '../utils/whatsapp';
import {
  cacheAdminMessengers,
  getCachedAdminMessengers,
  cacheAdminUsers,
  getCachedAdminUsers,
  cacheAdminOrders,
  getCachedAdminOrders,
  cacheAdminStats,
  getCachedAdminStats,
} from '../lib/db';
import {
  Users,
  Package,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  RotateCw,
  Power,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileCheck2,
  Eye,
  ExternalLink,
  X,
  Search,
  UserCheck,
  UserX,
  Key,
  Trash2,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Bike,
} from 'lucide-react';

interface AdminDashboardProps {
  messengers: Messenger[];
  onRefreshMessengers: () => void;
  currentUserEmail?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  messengers: initialMessengers,
  onRefreshMessengers,
  currentUserEmail = 'comfort.designszw@gmail.com',
}) => {
  const [activeTab, setActiveTab] = useState<'kyc' | 'overview' | 'orders' | 'users'>('kyc');
  const [allMessengers, setAllMessengers] = useState<Messenger[]>(initialMessengers);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // KYC Filter: 'pending' | 'verified' | 'rejected' | 'all'
  const [kycFilter, setKycFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const [kycSearch, setKycSearch] = useState('');

  // Image inspection modal
  const [inspectImage, setInspectImage] = useState<{ url: string; title: string } | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      // 1. Immediately load local cache for instantaneous UX
      const cachedStats = getCachedAdminStats();
      if (cachedStats) setStats(cachedStats);

      const [cMessengers, cUsers, cOrders] = await Promise.all([
        getCachedAdminMessengers(),
        getCachedAdminUsers(),
        getCachedAdminOrders(),
      ]);
      if (cMessengers.length > 0) setAllMessengers(cMessengers);
      if (cUsers.length > 0) setRegisteredUsers(cUsers);
      if (cOrders.length > 0) setAllOrders(cOrders);

      // 2. Fetch fresh live data from Postgres backend with Admin authorization
      const adminHeaders = {
        'x-user-email': currentUserEmail || 'comfort.designszw@gmail.com',
      };

      const [statsRes, messengersRes, usersRes, ordersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: adminHeaders, credentials: 'include' }),
        fetch('/api/admin/messengers', { headers: adminHeaders, credentials: 'include' }),
        fetch('/api/admin/users', { headers: adminHeaders, credentials: 'include' }),
        fetch('/api/admin/orders', { headers: adminHeaders, credentials: 'include' }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        cacheAdminStats(statsData);
      }

      if (messengersRes.ok) {
        const messengersData = await messengersRes.json();
        setAllMessengers(messengersData);
        await cacheAdminMessengers(messengersData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setRegisteredUsers(usersData);
        await cacheAdminUsers(usersData);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setAllOrders(ordersData);
        await cacheAdminOrders(ordersData);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUserEmail || 'comfort.designszw@gmail.com',
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const updated = registeredUsers.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
        setRegisteredUsers(updated);
        await cacheAdminUsers(updated);
      }
    } catch (e) {
      alert('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to remove user ${userEmail}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': currentUserEmail || 'comfort.designszw@gmail.com',
        },
        credentials: 'include',
      });
      if (res.ok) {
        const updated = registeredUsers.filter((u) => u.id !== userId);
        setRegisteredUsers(updated);
        await cacheAdminUsers(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to remove user');
      }
    } catch (e) {
      alert('Error removing user');
    }
  };

  const handleDeleteMessenger = async (messengerId: string, messengerName: string) => {
    if (!confirm(`Are you sure you want to permanently delete runner ${messengerName}?`)) return;
    try {
      const res = await fetch(`/api/admin/messengers/${messengerId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': currentUserEmail || 'comfort.designszw@gmail.com',
        },
        credentials: 'include',
      });
      if (res.ok) {
        const updated = allMessengers.filter((m) => m.id !== messengerId);
        setAllMessengers(updated);
        await cacheAdminMessengers(updated);
        onRefreshMessengers();
      } else {
        alert('Failed to delete runner profile');
      }
    } catch (e) {
      alert('Network error while deleting runner');
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [currentUserEmail]);

  const handleKycAction = async (
    messengerId: string,
    isVerified: boolean,
    status: 'verified' | 'rejected' | 'pending',
    notes?: string
  ) => {
    try {
      setUpdatingId(messengerId);
      const res = await fetch(`/api/admin/messengers/${messengerId}/kyc`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUserEmail || 'comfort.designszw@gmail.com',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_verified: isVerified,
          kyc_status: status,
          kyc_notes: notes || '',
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        const updatedList = allMessengers.map((m) => (m.id === messengerId ? updated : m));
        setAllMessengers(updatedList);
        await cacheAdminMessengers(updatedList);
        onRefreshMessengers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to update KYC status: ' + (err.error || 'Server error'));
      }
    } catch (e) {
      console.error(e);
      alert('Network error while updating KYC.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (messenger: Messenger) => {
    try {
      setUpdatingId(messenger.id);
      const res = await fetch(`/api/admin/messengers/${messenger.id}/deactivate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUserEmail || 'comfort.designszw@gmail.com',
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: !messenger.is_active }),
      });
      if (res.ok) {
        const updated = await res.json();
        const updatedList = allMessengers.map((m) => (m.id === messenger.id ? updated : m));
        setAllMessengers(updatedList);
        await cacheAdminMessengers(updatedList);
        onRefreshMessengers();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered messengers for KYC desk
  const pendingCount = allMessengers.filter(
    (m) => m.kyc_status === 'pending' || (!m.is_verified && m.kyc_status !== 'rejected')
  ).length;

  const filteredKycMessengers = allMessengers.filter((m) => {
    const status = m.kyc_status || (m.is_verified ? 'verified' : 'pending');
    if (kycFilter !== 'all' && status !== kycFilter) return false;
    if (kycSearch.trim()) {
      const q = kycSearch.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.whatsapp_number.toLowerCase().includes(q) ||
        m.area_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header with Refresh & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900">Admin Control & KYC Desk</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Verified Administrator
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Review applicant National IDs & Driver's Licenses, verify runners, and monitor platform operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('kyc')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'kyc'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>KYC Verification</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Fleet ({allMessengers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Orders ({allOrders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users ({registeredUsers.length})</span>
            </button>
          </div>

          <button
            onClick={() => {
              fetchAdminData();
              onRefreshMessengers();
            }}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Pending KYC Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{pendingCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting ID verification</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Verified Runners</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {allMessengers.filter((m) => m.is_verified).length}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            Live on Home & Order pages
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Orders Logged</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.total_orders ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">All errand requests</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Completed Value</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-700">
            ${(stats?.total_completed_value_usd ?? 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">USD errand volume</div>
        </div>
      </div>

      {/* TAB 1: KYC VERIFICATION DESK */}
      {activeTab === 'kyc' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Filter Status:
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {(['pending', 'verified', 'rejected', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setKycFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl capitalize transition ${
                      kycFilter === filter
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {filter === 'pending' ? `Pending (${pendingCount})` : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search runner name, area..."
                value={kycSearch}
                onChange={(e) => setKycSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* List of Runners Pending/Verified */}
          {filteredKycMessengers.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">
                {kycFilter === 'pending'
                  ? 'All KYC Submissions Cleared!'
                  : 'No runners match this filter'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {kycFilter === 'pending'
                  ? 'There are currently no runner profiles waiting for National ID or license review.'
                  : 'Try selecting a different status filter above.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredKycMessengers.map((runner) => {
                const isVehicle = runner.transport_mode === 'motorbike' || runner.transport_mode === 'car';
                const status = runner.kyc_status || (runner.is_verified ? 'verified' : 'pending');

                return (
                  <div
                    key={runner.id}
                    className={`bg-white rounded-3xl p-6 border shadow-xs transition space-y-4 ${
                      status === 'pending'
                        ? 'border-amber-300 ring-2 ring-amber-100'
                        : status === 'verified'
                        ? 'border-emerald-200'
                        : 'border-rose-200'
                    }`}
                  >
                    {/* Top Row: Runner Details & Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <img
                          src={runner.photo_url}
                          alt={runner.name}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-200"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 text-base">
                              {runner.name}
                            </h3>
                            {status === 'verified' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <ShieldCheck className="w-3.5 h-3.5" /> Verified & Published
                              </span>
                            )}
                            {status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                <Clock className="w-3.5 h-3.5" /> Pending Admin Review
                              </span>
                            )}
                            {status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                <XCircle className="w-3.5 h-3.5" /> Rejected
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{runner.whatsapp_number}</span>
                            <span>•</span>
                            <span>{runner.area_name} (~{runner.radius_km}km radius)</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">
                              {TRANSPORT_MODE_LABELS[runner.transport_mode]?.icon}{' '}
                              {TRANSPORT_MODE_LABELS[runner.transport_mode]?.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Approval Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {status !== 'verified' ? (
                          <button
                            onClick={() => handleKycAction(runner.id, true, 'verified')}
                            disabled={updatingId === runner.id}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Verify & Publish Runner</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleKycAction(runner.id, false, 'pending')}
                            disabled={updatingId === runner.id}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                          >
                            Revoke Verification
                          </button>
                        )}

                        {status !== 'rejected' && (
                          <button
                            onClick={() => {
                              const reason = prompt('Optional rejection reason (e.g. Blurry ID card):');
                              handleKycAction(runner.id, false, 'rejected', reason || 'Documents could not be verified');
                            }}
                            disabled={updatingId === runner.id}
                            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition"
                          >
                            Reject KYC
                          </button>
                        )}
                      </div>
                    </div>

                    {/* KYC Documents Inspection Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      {/* 1. National ID Front */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-700">
                            National ID — Front
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-sm">
                            Mandatory
                          </span>
                        </div>
                        {runner.national_id_front ? (
                          <div
                            onClick={() =>
                              setInspectImage({
                                url: runner.national_id_front!,
                                title: `${runner.name} - National ID Front`,
                              })
                            }
                            className="relative h-28 rounded-xl overflow-hidden cursor-pointer group bg-black/5"
                          >
                            <img
                              src={runner.national_id_front}
                              alt="ID Front"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Inspect
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-center p-2 text-[11px] text-slate-400">
                            No front ID uploaded
                          </div>
                        )}
                      </div>

                      {/* 2. National ID Back */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-700">
                            National ID — Back
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-sm">
                            Mandatory
                          </span>
                        </div>
                        {runner.national_id_back ? (
                          <div
                            onClick={() =>
                              setInspectImage({
                                url: runner.national_id_back!,
                                title: `${runner.name} - National ID Back`,
                              })
                            }
                            className="relative h-28 rounded-xl overflow-hidden cursor-pointer group bg-black/5"
                          >
                            <img
                              src={runner.national_id_back}
                              alt="ID Back"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Inspect
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-center p-2 text-[11px] text-slate-400">
                            No back ID uploaded
                          </div>
                        )}
                      </div>

                      {/* 3. Driver's Licence Front */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-700">
                            Driver's Licence — Front
                          </span>
                          {isVehicle ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-sm">
                              Required
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded-sm">
                              Exempted
                            </span>
                          )}
                        </div>
                        {runner.driver_licence_front ? (
                          <div
                            onClick={() =>
                              setInspectImage({
                                url: runner.driver_licence_front!,
                                title: `${runner.name} - Driver's Licence Front`,
                              })
                            }
                            className="relative h-28 rounded-xl overflow-hidden cursor-pointer group bg-black/5"
                          >
                            <img
                              src={runner.driver_licence_front}
                              alt="Licence Front"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Inspect
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-2 text-[11px] text-slate-400">
                            {isVehicle ? 'Missing required licence' : 'Exempted (No vehicle)'}
                          </div>
                        )}
                      </div>

                      {/* 4. Driver's Licence Back */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-700">
                            Driver's Licence — Back
                          </span>
                          {isVehicle ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-sm">
                              Required
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded-sm">
                              Exempted
                            </span>
                          )}
                        </div>
                        {runner.driver_licence_back ? (
                          <div
                            onClick={() =>
                              setInspectImage({
                                url: runner.driver_licence_back!,
                                title: `${runner.name} - Driver's Licence Back`,
                              })
                            }
                            className="relative h-28 rounded-xl overflow-hidden cursor-pointer group bg-black/5"
                          >
                            <img
                              src={runner.driver_licence_back}
                              alt="Licence Back"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Inspect
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-2 text-[11px] text-slate-400">
                            {isVehicle ? 'Missing required licence' : 'Exempted (No vehicle)'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FLEET & ORDERS OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Orders Volume Breakdown by Status */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">Order Volume by Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
              {[
                { label: 'Pending', count: stats?.orders_by_status?.pending ?? 0, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                { label: 'Negotiating', count: stats?.orders_by_status?.negotiating ?? 0, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                { label: 'Accepted', count: stats?.orders_by_status?.accepted ?? 0, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                { label: 'In Progress', count: stats?.orders_by_status?.in_progress ?? 0, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
                { label: 'Completed', count: stats?.orders_by_status?.completed ?? 0, color: 'text-teal-600 bg-teal-50 border-teal-200' },
                { label: 'Rejected', count: stats?.orders_by_status?.rejected ?? 0, color: 'text-rose-600 bg-rose-50 border-rose-200' },
              ].map((item) => (
                <div key={item.label} className={`p-3 rounded-2xl border ${item.color}`}>
                  <div className="text-xl font-black">{item.count}</div>
                  <div className="text-[11px] font-bold uppercase mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Messengers Fleet Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Messengers Fleet</h3>
              <span className="text-xs text-slate-500">Deactivate / activate runners</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Runner</th>
                    <th className="pb-3">WhatsApp</th>
                    <th className="pb-3">Transport</th>
                    <th className="pb-3">KYC Status</th>
                    <th className="pb-3">Area Served</th>
                    <th className="pb-3">Rating</th>
                    <th className="pb-3">Completed</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allMessengers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                        <img
                          src={m.photo_url}
                          alt={m.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                        <span>{m.name}</span>
                      </td>
                      <td className="py-3 font-mono text-slate-600">{m.whatsapp_number}</td>
                      <td className="py-3 font-semibold capitalize text-slate-700">
                        {m.transport_mode}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            m.is_verified
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {m.is_verified ? 'Verified' : 'Pending KYC'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{m.area_name}</td>
                      <td className="py-3 text-amber-600 font-bold">★{m.rating_avg.toFixed(1)}</td>
                      <td className="py-3 font-semibold text-slate-800">{m.errands_completed}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            m.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {m.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleActive(m)}
                            disabled={updatingId === m.id}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition ${
                              m.is_active
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {m.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                          <button
                            onClick={() => handleDeleteMessenger(m.id, m.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete runner permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM ERRANDS & ORDERS MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Live Errands & Order Dispatch</h3>
              <p className="text-xs text-slate-500">
                Monitor all platform errand deliveries across Zimbabwe, review negotiated fees, and contact parties on WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="all">All Statuses ({allOrders.length})</option>
                <option value="pending">Pending</option>
                <option value="negotiating">Negotiating</option>
                <option value="accepted">Accepted</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search orderer, shop, address..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">Order ID & Type</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Assigned Runner</th>
                  <th className="pb-3">Pickup → Delivery</th>
                  <th className="pb-3">Scheduled</th>
                  <th className="pb-3">Fee (USD)</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allOrders
                  .filter((o) => {
                    if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
                    if (orderSearch.trim()) {
                      const q = orderSearch.toLowerCase();
                      return (
                        o.id.toLowerCase().includes(q) ||
                        o.orderer_name?.toLowerCase().includes(q) ||
                        o.orderer_whatsapp?.toLowerCase().includes(q) ||
                        o.shop_name?.toLowerCase().includes(q) ||
                        o.pickup_address?.toLowerCase().includes(q) ||
                        o.delivery_address?.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((order) => {
                    const errandLabel = ERRAND_TYPE_LABELS[order.errand_type as keyof typeof ERRAND_TYPE_LABELS]?.label || order.errand_type;
                    const finalFee = order.agreed_charge || order.proposed_charge;
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3">
                          <div className="font-bold text-slate-900 font-mono text-[11px]">{order.id}</div>
                          <div className="text-[11px] text-slate-500">{errandLabel}</div>
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-slate-800">{order.orderer_name}</div>
                          <div className="font-mono text-slate-500 text-[11px] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{order.orderer_whatsapp}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          {order.messenger_name ? (
                            <div>
                              <div className="font-bold text-slate-800">{order.messenger_name}</div>
                              <div className="font-mono text-slate-500 text-[11px]">{order.messenger_whatsapp}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 max-w-[200px]">
                          <div className="truncate text-slate-700">📍 {order.pickup_address}</div>
                          <div className="truncate text-slate-500">🏁 {order.delivery_address}</div>
                        </td>
                        <td className="py-3 text-slate-600 font-mono text-[11px]">
                          {order.scheduled_datetime ? new Date(order.scheduled_datetime).toLocaleString() : 'ASAP'}
                        </td>
                        <td className="py-3 font-bold text-slate-900">
                          ${finalFee?.toFixed(2)}
                          {order.agreed_charge && order.agreed_charge !== order.proposed_charge && (
                            <span className="block text-[10px] text-emerald-700 font-medium">(negotiated)</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              order.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'in_progress'
                                ? 'bg-indigo-100 text-indigo-800'
                                : order.status === 'accepted'
                                ? 'bg-teal-100 text-teal-800'
                                : order.status === 'negotiating'
                                ? 'bg-blue-100 text-blue-800'
                                : order.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <a
                            href={buildWhatsAppDeepLink(
                              order.orderer_whatsapp,
                              `Hello ${order.orderer_name}, this is WhaRunner Admin desk regarding order ${order.id}.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] transition"
                            title="Chat with Customer on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REGISTERED USERS & ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Registered Users & Authentication Console</h3>
              <p className="text-xs text-slate-500">
                All platform users (Google SSO, Phone & Password, and Email credentials) with runner linkage.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user name or email..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">User</th>
                  <th className="pb-3">Auth Provider</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Runner Status</th>
                  <th className="pb-3">Registered</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registeredUsers
                  .filter((u) => {
                    if (!userSearch) return true;
                    const q = userSearch.toLowerCase();
                    return (
                      u.name?.toLowerCase().includes(q) ||
                      u.email?.toLowerCase().includes(q) ||
                      u.phone?.toLowerCase().includes(q)
                    );
                  })
                  .map((u) => {
                    const isSuperAdmin = u.email === 'comfort.designszw@gmail.com';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {u.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{u.name}</span>
                                {isSuperAdmin && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 text-[9px] font-black uppercase">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                {u.email.includes('wharunner.internal') ? (
                                  <>
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    <span>{u.phone || u.email.replace(/[^\d+]/g, '')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    <span>{u.email}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {u.auth_provider === 'google' && 'Google SSO'}
                            {u.auth_provider === 'phone_virtual' && 'Phone & Password'}
                            {u.auth_provider === 'credentials' && 'Email & Password'}
                            {!['google', 'phone_virtual', 'credentials'].includes(u.auth_provider) && (u.auth_provider || 'Direct')}
                          </span>
                        </td>

                        <td className="py-3">
                          <select
                            value={u.role || 'user'}
                            disabled={isSuperAdmin}
                            onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                          >
                            <option value="user">User / Client</option>
                            <option value="runner">Runner</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>

                        <td className="py-3">
                          {u.runner_id ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.runner_is_verified
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {u.runner_is_verified ? 'Verified Runner' : `Pending KYC (${u.runner_transport_mode || 'runner'})`}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">None</span>
                          )}
                        </td>

                        <td className="py-3 text-[11px] text-slate-500">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}
                        </td>

                        <td className="py-3 text-right">
                          {!isSuperAdmin && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                              title="Remove user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KYC Document High-Res Zoom Modal */}
      {inspectImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-3">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">{inspectImage.title}</h4>
              <button
                onClick={() => setInspectImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-950">
              <img
                src={inspectImage.url}
                alt={inspectImage.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="p-3 text-center text-xs text-slate-500">
              Verify that the name, photo, and national details are authentic and legible.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

