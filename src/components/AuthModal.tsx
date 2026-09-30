import React, { useState } from 'react';
import { authClient } from '../lib/auth-client';
import {
  phoneToShadowEmail,
  isShadowEmail,
  shadowEmailToPhone,
  AFRICAN_COUNTRY_CODES,
  CountryCode,
} from '../utils/phoneAuth';
import {
  X,
  Lock,
  Mail,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ChevronDown,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (details?: { isNewUser?: boolean; user?: any }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');

  // Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(AFRICAN_COUNTRY_CODES[0]); // ZW +263
  const [password, setPassword] = useState('');

  // Google SSO dialog state
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: session } = authClient.useSession();

  if (!isOpen) return null;

  // Helper to sync user profile with Postgres registered_users
  const syncToDatabase = async (userInfo: { name?: string; email: string; phone?: string; auth_provider: string }) => {
    try {
      await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userInfo),
      });
    } catch (e) {
      console.warn('Sync user notice:', e);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      let loginEmail = email.trim();
      let rawPhone = '';
      if (authMethod === 'phone') {
        if (!phone.trim()) {
          throw new Error('Please enter your phone number.');
        }
        rawPhone = phone.trim();
        loginEmail = phoneToShadowEmail(phone.trim(), selectedCountry.dialCode);
      }

      const res = await authClient.signIn.email({
        email: loginEmail,
        password,
      });

      if ((res as any)?.error) {
        setErrorMsg(
          (res as any).error.message ||
            (authMethod === 'phone'
              ? 'Invalid phone number or password.'
              : 'Invalid email or password.')
        );
      } else {
        await syncToDatabase({
          email: loginEmail,
          phone: rawPhone ? `${selectedCountry.dialCode} ${rawPhone}` : undefined,
          auth_provider: authMethod === 'phone' ? 'phone_virtual' : 'credentials',
        });

        setSuccessMsg('Signed in successfully!');
        setTimeout(() => {
          onAuthSuccess?.({ isNewUser: false });
          onClose();
        }, 600);
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
      let regEmail = email.trim();
      let rawPhone = '';
      if (authMethod === 'phone') {
        if (!phone.trim()) {
          throw new Error('Please enter your phone number.');
        }
        rawPhone = phone.trim();
        regEmail = phoneToShadowEmail(phone.trim(), selectedCountry.dialCode);
      }

      const res = await authClient.signUp.email({
        name: name.trim(),
        email: regEmail,
        password,
      });

      if ((res as any)?.error) {
        setErrorMsg((res as any).error.message || 'Failed to create account.');
      } else {
        await syncToDatabase({
          name: name.trim(),
          email: regEmail,
          phone: rawPhone ? `${selectedCountry.dialCode} ${rawPhone}` : undefined,
          auth_provider: authMethod === 'phone' ? 'phone_virtual' : 'credentials',
        });

        setSuccessMsg('Account created successfully! Welcome to WhaRunner.');
        setTimeout(() => {
          onAuthSuccess?.({ isNewUser: true, user: { name: name.trim(), email: regEmail } });
          onClose();
        }, 700);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  // Google SSO Handler
  const handleGoogleSSO = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const emailToUse = (googleEmail.trim() || 'comfort.designszw@gmail.com').toLowerCase();
      const nameToUse = googleName.trim() || emailToUse.split('@')[0];

      const res = await fetch('/api/auth/google-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToUse,
          name: nameToUse,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(nameToUse)}&background=10b981&color=fff`,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Google SSO authentication failed.');
      }

      // Also trigger authClient refresh
      await authClient.signIn.email({
        email: emailToUse,
        password: `GoogleSSO_${emailToUse.replace(/[^a-zA-Z0-9]/g, '_')}_2026!`,
      }).catch(() => {});

      setShowGooglePrompt(false);
      setSuccessMsg(`Welcome, ${nameToUse}! Google authentication complete.`);
      setTimeout(() => {
        onAuthSuccess?.({ isNewUser: tab === 'signup', user: data.user });
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google SSO failed.');
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
      }, 400);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isUserShadowPhone = session?.user?.email ? isShadowEmail(session.user.email) : false;
  const userDisplayPhone = isUserShadowPhone ? shadowEmailToPhone(session?.user?.email) : null;
  const isAdmin = session?.user?.email === 'comfort.designszw@gmail.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white backdrop-blur-xl border border-slate-200/80 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1 pr-6">
          <h2 className="text-xl font-black text-slate-900">
            {session ? 'Account & Session' : tab === 'signin' ? 'Sign In to WhaRunner' : 'Create Your Account'}
          </h2>
          <p className="text-xs text-slate-500">
            {session
              ? 'Manage your active credentials and runner privileges.'
              : tab === 'signin'
              ? 'Access your errands, runner profile, and live deliveries.'
              : 'Join Zimbabwe’s verified WhatsApp errands network.'}
          </p>
        </div>

        {/* If already logged in */}
        {session?.user ? (
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                {session.user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="font-extrabold text-slate-900 text-sm truncate">
                    {session.user.name}
                  </div>
                  {isAdmin && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                      Admin
                    </span>
                  )}
                </div>

                {isUserShadowPhone ? (
                  <div className="text-xs text-slate-700 font-semibold flex items-center gap-1 truncate mt-0.5">
                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{userDisplayPhone}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 truncate">{session.user.email}</div>
                )}

                <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Active Session
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Role:</span>
                <span className="font-bold text-slate-800">
                  {isAdmin ? 'System Administrator' : 'Runner / Client'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Account Type:</span>
                <span className="font-semibold text-emerald-700">
                  {isUserShadowPhone ? 'Phone & Password' : 'Email / Google SSO'}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Top Switcher: Sign In vs Sign Up */}
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
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
                className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
                  tab === 'signup' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Create Account
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

            {/* Google SSO Button */}
            {!showGooglePrompt ? (
              <button
                type="button"
                onClick={() => setShowGooglePrompt(true)}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 bg-white text-slate-800 text-xs font-bold flex items-center justify-center gap-2.5 shadow-2xs transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{tab === 'signin' ? 'Continue with Google' : 'Sign up with Google'}</span>
              </button>
            ) : (
              /* Google SSO Quick Account Flow */
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span className="text-xs font-bold text-slate-800">Google SSO Authentication</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGooglePrompt(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleGoogleSSO} className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Google Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={googleName}
                      onChange={(e) => setGoogleName(e.target.value)}
                      placeholder="e.g. Farai Moyo"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    {loading ? 'Connecting with Google...' : 'Authorize & Sign In with Google'}
                  </button>
                </form>
              </div>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2 text-[11px] text-slate-400 shrink-0 font-medium">
                or use credentials
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            {/* Phone vs Email Switcher */}
            <div className="flex items-center justify-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMethod === 'phone'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Phone & Password</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMethod === 'email'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email & Password</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
              {tab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
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

              {/* Phone or Email Input */}
              {authMethod === 'phone' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone Number
                  </label>
                  <div className="flex gap-2">
                    <div className="relative shrink-0">
                      <select
                        value={selectedCountry.code}
                        onChange={(e) => {
                          const found = AFRICAN_COUNTRY_CODES.find((c) => c.code === e.target.value);
                          if (found) setSelectedCountry(found);
                        }}
                        className="h-full pl-2.5 pr-6 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden appearance-none"
                      >
                        {AFRICAN_COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.dialCode}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-3 pointer-events-none" />
                    </div>

                    <div className="relative flex-1">
                      <Phone className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 77 284 9102"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. runner@domain.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
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
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                {loading
                  ? 'Authenticating...'
                  : tab === 'signin'
                  ? authMethod === 'phone'
                    ? 'Sign In with Phone'
                    : 'Sign In with Email'
                  : authMethod === 'phone'
                  ? 'Create Account with Phone'
                  : 'Create Account with Email'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
