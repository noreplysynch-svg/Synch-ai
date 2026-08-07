import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, Sparkles, Monitor, Info } from 'lucide-react';

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(true); // Default true so banner is accessible
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edgios/.test(userAgent);
    
    if (iosDevice && isSafari) {
      setIsIOS(true);
    }

    // Capture standard install prompt (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('Synch AI PWA successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable, isInstalled, isIOS, triggerInstall, hasPrompt: !!deferredPrompt };
};

export default function InstallPWABanner() {
  const { isInstallable, isInstalled, isIOS, triggerInstall, hasPrompt } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('synch_pwa_banner_dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('synch_pwa_banner_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (hasPrompt) {
      const handled = await triggerInstall();
      if (!handled) setShowModal(true);
    } else {
      setShowModal(true);
    }
  };

  if (isInstalled || !isInstallable || dismissed) {
    return null;
  }

  return (
    <>
      {/* Top Floating PWA Banner - Positioned below top bar so it NEVER blocks the bottom chat input */}
      <div className="fixed top-14 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 border border-cyan-500/30 p-3.5 shadow-2xl backdrop-blur-xl text-slate-100 flex items-center gap-3 select-none">
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 pointer-events-none" />
          
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-md flex-shrink-0 flex items-center justify-center pointer-events-none">
            <img 
              src="/pwa-icon-192.png" 
              alt="Synch AI" 
              className="w-full h-full rounded-[8px] object-cover pointer-events-none"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
          </div>

          <div className="flex-1 min-w-0 pointer-events-none">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-cyan-400 pointer-events-none">
              <Sparkles className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">Install Synch AI App</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate pointer-events-none">
              Offline-ready & native mobile experience
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-white font-medium text-xs transition-all shadow-md flex items-center gap-1.5 touch-manipulation cursor-pointer select-none"
            >
              {isIOS ? <Smartphone className="w-3.5 h-3.5 pointer-events-none" /> : <Download className="w-3.5 h-3.5 pointer-events-none" />}
              <span className="pointer-events-none">Install</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close install prompt"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 active:scale-90 transition-all touch-manipulation cursor-pointer"
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>
        </div>
      </div>

      {/* Universal Instructions Modal (iOS, Android, Desktop) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-5 select-none">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:scale-90 transition-all touch-manipulation cursor-pointer"
            >
              <X className="w-5 h-5 pointer-events-none" />
            </button>

            <div className="flex items-center gap-3 pointer-events-none">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 pointer-events-none">
                <Sparkles className="w-6 h-6 pointer-events-none" />
              </div>
              <div className="pointer-events-none">
                <h3 className="text-base font-semibold text-slate-100 pointer-events-none">Install Synch AI App</h3>
                <p className="text-xs text-slate-400 pointer-events-none">Add to your Mobile Home Screen</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold pointer-events-none">1</div>
                  <div className="pointer-events-none">
                    Tap the <strong className="text-cyan-300 inline-flex items-center gap-1 pointer-events-none"><Share className="w-3.5 h-3.5 inline pointer-events-none" /> Share</strong> button in Safari's bottom bar.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold pointer-events-none">2</div>
                  <div className="pointer-events-none">
                    Scroll down and select <strong className="text-cyan-300 inline-flex items-center gap-1 pointer-events-none"><PlusSquare className="w-3.5 h-3.5 inline pointer-events-none" /> Add to Home Screen</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold pointer-events-none">3</div>
                  <div className="pointer-events-none">
                    Tap <strong className="text-cyan-300 pointer-events-none">Add</strong> at top right to install.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold pointer-events-none">1</div>
                  <div className="pointer-events-none">
                    Tap the browser menu button (<strong>⋮ 3 dots</strong> in Chrome/Edge top-right corner).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold pointer-events-none">2</div>
                  <div className="pointer-events-none">
                    Select <strong className="text-cyan-300 pointer-events-none">"Install app"</strong> or <strong className="text-cyan-300 pointer-events-none">"Add to Home screen"</strong>.
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-medium text-xs transition-all touch-manipulation cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
