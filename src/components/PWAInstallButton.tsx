import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f2fe]"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/40 text-xs font-medium text-[#00f2fe] whitespace-nowrap shrink-0 transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>App iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#151c25] border border-[#3a494b] p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-semibold text-[#e0fdff]">
                Installer MarineVision AI sur iOS
              </h3>
              <p className="text-xs text-[#9eb2b8] leading-relaxed">
                1. Touchez le bouton <strong className="text-[#e0fdff]">Partager</strong> dans
                Safari.
                <br />
                2. Faites défiler et touchez{' '}
                <strong className="text-[#e0fdff]">Sur l&apos;écran d&apos;accueil</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-[#00f2fe] py-2 text-xs font-semibold text-[#002022]"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-6 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#ffba38] px-3.5 py-2 text-xs font-semibold text-[#002022] shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Hors Ligne — Cache Network-First actif</span>
    </div>
  );
};
