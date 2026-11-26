import React, { useRef } from 'react';
import { Compass, LayoutGrid, QrCode, Radar, Share2, SlidersHorizontal, UserCheck } from 'lucide-react';
import { TabId } from '../types/marine';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: TabId;
  isAdmin: boolean;
  onSelectTab: (tab: TabId) => void;
  onOpenProfile: () => void;
  onSecretAdminTrigger: () => void;
  onShareApp: () => void;
  onOpenQrShare: () => void;
}

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard-bento', label: 'Bento', icon: LayoutGrid },
  { id: 'carte-sonar', label: 'Sonar', icon: Radar },
  { id: 'waypoints-nav', label: 'Nav', icon: Compass },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isAdmin,
  onSelectTab,
  onOpenProfile,
  onSecretAdminTrigger,
  onShareApp,
  onOpenQrShare,
}) => {
  const isSettingsActive = activeTab === 'agent-mcp-config';
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);

  const handleBrandClick = () => {
    onSelectTab('dashboard-bento');
    clickCountRef.current += 1;
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
    }
    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      clickTimerRef.current = null;
      onSecretAdminTrigger();
      return;
    }
    clickTimerRef.current = window.setTimeout(() => {
      clickCountRef.current = 0;
      clickTimerRef.current = null;
    }, 2500);
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 min-h-16 bg-[#080f18]/95 backdrop-blur-xl border-b border-[#3a494b]/40">
        <div className="max-w-6xl mx-auto min-h-16 px-3 sm:px-6 py-2 md:py-0 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Brand wordmark (silent 5-click trigger for Admin PIN modal) */}
          <button
            type="button"
            onClick={handleBrandClick}
            className="flex items-center gap-2 sm:gap-2.5 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f2fe] rounded-lg"
          >
            <span className="h-8 w-8 rounded-lg bg-[#0C1B30] border border-[#00f2fe]/40 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/1795436584763_98eb2835.jpg"
                alt="Marina Visionnaire Méditerranée"
                className="w-full h-full object-cover"
              />
            </span>
            <span className="text-sm sm:text-lg font-semibold tracking-tight text-[#e0fdff] leading-tight">
              Marina Visionnaire
            </span>
          </button>

          {/* Zone 2: Desktop Single-Line Primary Sea Navigation */}
          <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 py-1.5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f2fe] ${
                    isActive
                      ? 'text-[#00f2fe] border-[#00f2fe]'
                      : 'text-[#9eb2b8] border-transparent hover:text-[#e0fdff]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Distribution Share + PWA Install + Passerelle / Mode Invité */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 ml-auto md:ml-0">
            <button
              type="button"
              onClick={onShareApp}
              aria-label="Partager l'application Marina Visionnaire"
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/40 text-[#00f2fe] text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Partager</span>
            </button>
            <button
              type="button"
              onClick={onOpenQrShare}
              aria-label="Afficher le QR Code de distribution"
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 text-[#40dcca] text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">QR Code</span>
            </button>
            <PWAInstallButton />
            <button
              type="button"
              onClick={onOpenProfile}
              aria-label={
                isAdmin
                  ? 'Ouvrir paramètres Passerelle Méditerranéenne et Agent MCP'
                  : 'Menu Mode Invité et Passerelle Méditerranéenne'
              }
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border text-[11px] sm:text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f2fe] ${
                isSettingsActive
                  ? 'bg-[#19202a] border-[#00f2fe]/60 text-[#00f2fe]'
                  : !isAdmin
                    ? 'bg-[#19202a] hover:bg-[#232a34] border-[#40dcca]/50 text-[#40dcca]'
                    : 'bg-[#19202a] hover:bg-[#232a34] border-[#3a494b]/60 text-[#e0fdff]'
              }`}
            >
              {isAdmin ? (
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#40dcca] shrink-0" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-[#40dcca] shrink-0" />
              )}
              <span>{isAdmin ? 'Passerelle Méditerranéenne' : 'Mode Invité'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (Simplified 3-column Sea Views) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#080f18]/95 backdrop-blur-xl border-t border-[#3a494b]/40"
      >
        <div className="grid grid-cols-3 h-full max-w-lg mx-auto px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'text-[#00f2fe]' : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
