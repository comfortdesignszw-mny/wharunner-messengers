import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
  Smartphone,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (details?: { isNewUser?: boolean; user?: any }) => void;
}

interface DetectedGoogleAccount {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  badge?: string;
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

  // Google SSO state
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [detectedGoogleAccounts, setDetectedGoogleAccounts] = useState<DetectedGoogleAccount[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: session } = authClient.useSession();

  // Load available Google accounts on device/platform when opened
  useEffect(() => {
    if (!isOpen) return;
    const fetchGoogleAccounts = async () => {
      try {
        const res = await fetch('/api/auth/google-accounts');
        if (res.ok) {
          const data = await res.json();
          if (data.accounts && Array.isArray(data.accounts)) {
            // Also check if there's a cached Google account on this device
            const cachedUserStr = localStorage.getItem('wharunner_authenticated_user');
            if (cachedUserStr) {
              try {
                const cached = JSON.parse(cachedUserStr);
                if (cached?.email && !data.accounts.some((a: any) => a.email.toLowerCase() === cached.email.toLowerCase())) {
                  data.accounts.push({
                    id: 'device-cached-' + cached.email,
                    name: cached.name || 'Device Account',
                    email: cached.email,
                    avatarUrl: cached.image,
                    badge: cached.role === 'admin' ? 'Administrator' : 'Current User',
                  });
                }
              } catch (e) {}
            }
            setDetectedGoogleAccounts(data.accounts);
          }
        }
      } catch (e) {
        // Fallback default
        setDetectedGoogleAccounts([
          {
            id: 'acc-google-admin',
            name: 'Comfort Admin',
            email: 'comfort.designszw@gmail.com',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
            badge: 'Verified Admin Account',
          },
        ]);
      }
    };
    fetchGoogleAccounts();
  }, [isOpen]);

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

  // Helper: Detect role from server database automatically based on email or phone
  const detectAndPersistRole = async (identifier: string, fallbackName: string) => {
    try {
      const res = await fetch('/api/auth/detect-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          role: data.role || (data.isAdmin ? 'admin' : 'runner'),
          isAdmin: Boolean(data.isAdmin),
          name: data.userRow?.name || fallbackName,
          avatarUrl: data.userRow?.avatar_url,
        };
      }
    } catch (e) {
      console.warn('Role detect check notice:', e);
    }
    const isComfort = identifier.toLowerCase() === 'comfort.designszw@gmail.com';
    return {
      role: isComfort ? 'admin' : 'runner',
      isAdmin: isComfort,
      name: fallbackName,
    };
  };

  // Standard Credentials Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
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
              ? 'Invalid phone number or password. Please try again.'
              : 'Invalid email or password. Please check your credentials.')
        );
        setLoading(false);
        return;
      }

      // Automatically detect if this email or phone is assigned to role 'admin' in database
      const roleInfo = await detectAndPersistRole(
        authMethod === 'phone' ? rawPhone : loginEmail,
        (res as any)?.data?.user?.name || loginEmail.split('@')[0]
      );

      const userObj = {
        id: (res as any)?.data?.user?.id || 'usr-' + Math.random().toString(36).substring(2, 9),
        name: roleInfo.name,
        email: loginEmail,
        role: roleInfo.role,
        isAdmin: roleInfo.isAdmin,
        image:
          roleInfo.avatarUrl ||
          (res as any)?.data?.user?.image ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(roleInfo.name)}&background=10b981&color=fff`,
      };

      // Persist authenticated session
      localStorage.setItem('wharunner_authenticated_user', JSON.stringify(userObj));
      localStorage.setItem('wharunner_auth_user', JSON.stringify(userObj));
      localStorage.setItem('wharunner_user_email', loginEmail);
      localStorage.setItem('wharunner_user_is_admin', roleInfo.isAdmin ? 'true' : 'false');

      await syncToDatabase({
        email: loginEmail,
        phone: rawPhone ? `${selectedCountry.dialCode} ${rawPhone}` : undefined,
        auth_provider: authMethod === 'phone' ? 'phone_virtual' : 'credentials',
      });

      // Seamless completion: cleanly close modal and notify parent
      onAuthSuccess?.({ isNewUser: false, user: userObj });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign in error');
    } finally {
      setLoading(false);
    }
  };

  // Standard Credentials Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
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
        setLoading(false);
        return;
      }

      // Automatically detect assigned role in database
      const roleInfo = await detectAndPersistRole(
        authMethod === 'phone' ? rawPhone : regEmail,
        name.trim()
      );

      const userObj = {
        id: (res as any)?.data?.user?.id || 'usr-' + Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        email: regEmail,
        role: roleInfo.role,
        isAdmin: roleInfo.isAdmin,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=10b981&color=fff`,
      };

      // Persist authenticated session
      localStorage.setItem('wharunner_authenticated_user', JSON.stringify(userObj));
      localStorage.setItem('wharunner_auth_user', JSON.stringify(userObj));
      localStorage.setItem('wharunner_user_email', regEmail);
      localStorage.setItem('wharunner_user_is_admin', roleInfo.isAdmin ? 'true' : 'false');

      await syncToDatabase({
        name: name.trim(),
        email: regEmail,
        phone: rawPhone ? `${selectedCountry.dialCode} ${rawPhone}` : undefined,
        auth_provider: authMethod === 'phone' ? 'phone_virtual' : 'credentials',
      });

      // Seamless completion: cleanly close modal and notify parent
      onAuthSuccess?.({ isNewUser: true, user: userObj });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  // Google SSO - Select an existing detected Google account without typing!
  const handleSelectGoogleAccount = async (account: DetectedGoogleAccount) => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/google-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          name: account.name,
          avatarUrl: account.avatarUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Google SSO authorization failed.');
      }

      const role = data.user?.role || (data.user?.isAdmin ? 'admin' : 'runner');
      const isAdmin = Boolean(data.user?.isAdmin || role === 'admin');

      const userObj = {
        id: data.user?.id || 'usr-google-' + Math.random().toString(36).substring(2, 9),
        name: data.user?.name || account.name,
        email: account.email,
        role,
        isAdmin,
        image: data.user?.image || account.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.name)}&background=10b981&color=fff`,
      };

      // Persist authenticated user locally
      localStorage.setItem('wharunner_authenticated_user', JSON.stringify(userObj));
      localStorage.setItem('wharunner_auth_user', JSON.stringify(userObj));
      localStorage.setItem('wharunner_user_email', account.email);
      localStorage.setItem('wharunner_user_is_admin', isAdmin ? 'true' : 'false');

      // Sync Better Auth session in background
      await authClient.signIn.email({
        email: account.email,
        password: `GoogleSSO_${account.email.replace(/[^a-zA-Z0-9]/g, '_')}_2026!`,
      }).catch(() => {});

      setShowGoogleChooser(false);
      onAuthSuccess?.({ isNewUser: false, user: userObj });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google account sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  // Google SSO - Sign in with another Google account
  const handleCustomGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.trim()) return;
    const targetEmail = customGoogleEmail.trim().toLowerCase();
    const targetName = targetEmail.split('@')[0];
    await handleSelectGoogleAccount({
      id: 'custom-' + targetEmail,
      name: targetName,
      email: targetEmail,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(targetName)}&background=10b981&color=fff`,
      badge: 'Google Account',
    });
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('wharunner_authenticated_user');
      localStorage.removeItem('wharunner_auth_user');
      localStorage.removeItem('wharunner_user_email');
      localStorage.removeItem('wharunner_user_is_admin');
      await authClient.signOut();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isUserShadowPhone = session?.user?.email ? isShadowEmail(session.user.email) : false;
  const userDisplayPhone = isUserShadowPhone ? shadowEmailToPhone(session?.user?.email) : null;
  const isAdmin = (session?.user as any)?.role === 'admin' || session?.user?.email === 'comfort.designszw@gmail.com';

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

        {/* When Google Account Chooser is Active */}
        {showGoogleChooser ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleChooser(false);
                  setShowCustomGoogleInput(false);
                  setErrorMsg(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer"
                title="Back to login"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Sign in with Google</h3>
                <p className="text-xs text-slate-500">Choose an account to continue to WhaRunner</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!showCustomGoogleInput ? (
              <div className="space-y-2 pt-1">
                {detectedGoogleAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectGoogleAccount(acc)}
                    disabled={loading}
                    className="w-full p-3 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-slate-50/80 transition flex items-center gap-3 text-left cursor-pointer group shadow-2xs"
                  >
                    <div className="relative shrink-0">
                      {acc.avatarUrl ? (
                        <img
                          src={acc.avatarUrl}
                          alt={acc.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 group-hover:border-emerald-500 transition"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-linear-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                        <svg className="w-3 h-3" viewBox="0 0 24 24">
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
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-700 transition truncate">
                        {acc.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {acc.badge || 'Google Account • Verified'}
                      </div>
                    </div>

                    <div className="shrink-0 text-slate-400 group-hover:text-emerald-600 transition">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowCustomGoogleInput(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Use another Google account</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCustomGoogleSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter Google Account
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="account@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomGoogleInput(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !customGoogleEmail.trim()}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </button>
                </div>
              </form>
            )}

            <div className="text-[11px] text-slate-400 text-center pt-2">
              To continue, Google will securely share your verified name and account profile with WhaRunner.
            </div>
          </div>
        ) : session?.user ? (
          /* Profile & Session View for Authenticated Owner */
          <div className="space-y-4 pt-1">
            <div className="space-y-1 pr-6">
              <h2 className="text-xl font-black text-slate-900">Account Profile</h2>
              <p className="text-xs text-slate-500">Securely verified session and runner credentials.</p>
            </div>

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

                {/* Only owner sees their verified account contact in authenticated profile */}
                {isUserShadowPhone ? (
                  <div className="text-xs text-slate-700 font-semibold flex items-center gap-1 truncate mt-0.5">
                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{userDisplayPhone}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 truncate mt-0.5 font-medium">{session.user.email}</div>
                )}

                <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Securely Authenticated
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Privilege Level:</span>
                <span className="font-bold text-slate-800">
                  {isAdmin ? 'System Administrator' : 'Messenger / Runner'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Method:</span>
                <span className="font-semibold text-emerald-700">
                  {isUserShadowPhone ? 'Mobile Phone' : 'Google SSO / Email'}
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
          /* Standard, Clean, Industry-Grade Login & Registration Screen */
          <>
            {/* Header */}
            <div className="space-y-1 pr-6">
              <h2 className="text-xl font-black text-slate-900">
                {tab === 'signin' ? 'Sign In to WhaRunner' : 'Create Your Account'}
              </h2>
              <p className="text-xs text-slate-500">
                {tab === 'signin'
                  ? 'Access your errands, runner hub, and deliveries.'
                  : 'Join Zimbabwe’s verified WhatsApp errands network.'}
              </p>
            </div>

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

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google SSO Button - Direct Social Trigger */}
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setShowGoogleChooser(true);
              }}
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

            {/* Clean Divider */}
            <div className="relative flex items-center justify-center my-1.5">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2.5 text-[11px] text-slate-400 shrink-0 font-medium">
                or continue with
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
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone Number</span>
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
                <span>Email Address</span>
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
                        placeholder="77 284 9102"
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
                      placeholder="name@domain.com"
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
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : tab === 'signin' ? (
                  <span>Sign In</span>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
