import React, { useState } from 'react';
import { authClient } from '../lib/auth-client';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
  ShieldAlert,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup' | '2fa'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: session } = authClient.useSession();

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if ((res as any)?.error) {
        setErrorMsg((res as any).error.message || 'Invalid email or password');
      } else {
        setSuccessMsg('Signed in successfully with Better Auth!');
        setTimeout(() => {
          onAuthSuccess?.();
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign in error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if ((res as any)?.error) {
        setErrorMsg((res as any).error.message || 'Failed to create account');
      } else {
        setSuccessMsg('Account registered with Better Auth! You are now logged in.');
        setTimeout(() => {
          onAuthSuccess?.();
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await authClient.signOut();
      setSuccessMsg('Signed out');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (demoEmail: string, demoPass: string, demoName: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setName(demoName);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Better Auth • Secure Authentication</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            {session ? 'Account & Session' : tab === 'signin' ? 'Sign In to WhaRunner' : 'Create an Account'}
          </h2>
          <p className="text-xs text-slate-500">
            {session
              ? 'Logged in with Better Auth TypeScript framework.'
              : 'Secure authentication with email/password, 2FA, and modular sessions.'}
          </p>
        </div>

        {/* If already logged in */}
        {session?.user ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base">
                {session.user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-slate-900 text-sm truncate">
                  {session.user.name}
                </div>
                <div className="text-xs text-slate-600 truncate">{session.user.email}</div>
                <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Active Better Auth Session
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <div className="font-bold text-slate-700">Better Auth Security Features:</div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Framework:</span>
                <span className="font-mono text-emerald-700 font-bold">Better Auth (TypeScript)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>2FA Plugin:</span>
                <span className="text-emerald-700 font-semibold">Enabled (TOTP & Authenticator)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Session Store:</span>
                <span className="text-slate-700">Persistent DB Adapter</span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>{loading ? 'Signing out...' : 'Sign Out of Better Auth'}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 rounded-xl transition ${
                  tab === 'signin' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('signup');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 rounded-xl transition ${
                  tab === 'signup' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Error & Success Messages */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-3.5">
              {tab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Tendai Moyo"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. runner@wharunner.co.zw"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                {loading
                  ? 'Processing Better Auth...'
                  : tab === 'signin'
                  ? 'Sign In with Better Auth'
                  : 'Register Account with Better Auth'}
              </button>
            </form>

            {/* Quick Demo Pre-fill Bar */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Quick Demo Accounts (Better Auth):
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => fillQuickDemo('admin@wharunner.co.zw', 'Admin12345!', 'Admin Officer')}
                  className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold truncate transition text-center"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickDemo('runner@wharunner.co.zw', 'Runner12345!', 'Blessing Runner')}
                  className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold truncate transition text-center"
                >
                  Runner
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickDemo('customer@wharunner.co.zw', 'Customer12345!', 'Chipo Customer')}
                  className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold truncate transition text-center"
                >
                  Customer
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
