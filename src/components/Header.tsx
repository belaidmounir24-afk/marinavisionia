import React from 'react';
import { Bot, Compass, LayoutGrid, Radar, User } from 'lucide-react';
import { TabId } from '../types/marine';

interface HeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenProfile: () => void;
}

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard-bento', label: 'Bento', icon: LayoutGrid },
  { id: 'carte-sonar', label: 'Sonar', icon: Radar },
  { id: 'waypoints-nav', label: 'Nav', icon: Compass },
  { id: 'agent-mcp-config', label: 'Agent MCP', icon: Bot },
];

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab, onOpenProfile }) => {
  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-16 bg-[#080f18]/90 backdrop-blur-xl border-b border-[#3a494b]/40">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('dashboard-bento')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f2fe] rounded-lg"
          >
            <span className="h-8 w-8 rounded-lg bg-[#19202a] border border-[#00f2fe]/30 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="13" stroke="#00f2fe" strokeOpacity="0.35" strokeWidth="1.5" />
                <circle
                  cx="16"
                  cy="16"
                  r="7.5"
                  stroke="#40dcca"
                  strokeOpacity="0.55"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
                <path d="M16 16 L24 7.5 A12 12 0 0 1 28 16 Z" fill="#00f2fe" fillOpacity="0.28" />
                <polygon points="16,8 20,20 16,17 12,20" fill="#00f2fe" />
                <circle cx="16" cy="16" r="2" fill="#e0fdff" />
              </svg>
            </span>
            <span className="text-base sm:text-lg font-semibold tracking-tight text-[#e0fdff] whitespace-nowrap">
              MarineVision AI
            </span>
          </button>

          {/* Zone 2: Desktop Single-Line Navigation */}
          <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-6">
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

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 text-xs font-medium text-[#e0fdff] whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f2fe]"
            >
              <User className="w-3.5 h-3.5 text-[#40dcca]" />
              <span>Passerelle Skikda</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#080f18]/95 backdrop-blur-xl border-t border-[#3a494b]/40"
      >
        <div className="grid grid-cols-4 h-full max-w-lg mx-auto px-2">
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
