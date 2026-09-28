import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, Smartphone } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 font-medium transition active:scale-95 shadow-sm rounded-lg ${
          compact
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-sm'
        }`}
        title="Install WhaRunner PWA on your home screen"
      >
        <Download className="w-4 h-4" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 font-medium transition active:scale-95 rounded-lg border border-emerald-600/30 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 ${
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'
          }`}
          title="Add WhaRunner to iPhone / iPad Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-left border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                  W
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Install WhaRunner on iOS</h3>
                  <p className="text-xs text-slate-500">Run errands offline anytime</p>
                </div>
              </div>
              <div className="space-y-3 my-4 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600 bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Tap the <strong>Share</strong> button <Share2 className="inline w-3.5 h-3.5 text-blue-500" /> in the Safari toolbar at the bottom of your screen.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600 bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600 bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> in the top-right corner to launch like a native Zim app!
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for browsers that don't emit beforeinstallprompt yet
  return (
    <button
      onClick={() => {
        if ('serviceWorker' in navigator) {
          alert('To install WhaRunner, open your browser menu (⋮ or Share) and tap "Add to Home screen" or "Install App".');
        }
      }}
      className={`hidden md:flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition`}
    >
      <Download className="w-3.5 h-3.5 text-emerald-600" />
      <span>Install PWA</span>
    </button>
  );
};
