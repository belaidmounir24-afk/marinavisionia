import React, { useEffect, useRef, useState } from 'react';
import {
  BatteryCharging,
  Bot,
  Code2,
  Compass,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  MapPin,
  Navigation,
  Play,
  QrCode,
  Radar,
  Satellite,
  Share2,
} from 'lucide-react';
import {
  MarineGpsTrackerConfig,
  MarineToolsConfig,
  NavigationZoneConfig,
  RadarBlipTarget,
  SubscriptionTier,
  TelemetryState,
} from '../types/marine';
import { getCardinal, NAVIGATION_ZONES } from '../utils/navigation';
import { CompassGpsCard } from './CompassGpsCard';
import { GPSWidget } from './GPSWidget';

interface BentoDashboardProps {
  telemetry: TelemetryState;
  biomassThreshold: number;
  lowPowerMode: boolean;
  headingApplied: boolean;
  gpsTracker: MarineGpsTrackerConfig;
  toolsConfig: MarineToolsConfig;
  activeZone?: NavigationZoneConfig;
  autoLogCountdownSec: number;
  isAdmin?: boolean;
  isCapturingPosition?: boolean;
  onSaveCurrentPosition: () => void;
  onShareApp: () => void;
  onOpenQrShare: () => void;
  onSelectBlip: (target: RadarBlipTarget) => void;
  onRunMcpPipeline: () => void;
  onApplyHeading: () => void;
  onEnableHardwareHook: () => void;
  onConfigureAutoLog: () => void;
  onExportSetupJson: () => void;
  onSelectPlan: (tier: SubscriptionTier) => void;
  onNotify: (msg: string) => void;
  onExport: (fmt: 'PDF' | 'XLSX' | 'JSON') => void;
  onNavigateTab: (tab: 'carte-sonar' | 'waypoints-nav' | 'agent-mcp-config') => void;
}

const RADAR_BLIPS: RadarBlipTarget[] = [
  {
    id: 'stora',
    name: 'Rade de Stora',
    depth: '28m',
    type: 'Banc Pélagique (Sardine / Pageot)',
    cert: '96.4%',
    label: 'Stora: 28m',
    positionClass: 'top-[36%] left-[32%]',
    color: 'cyan',
  },
  {
    id: 'cap-fer',
    name: 'Cap de Fer - Tombant',
    depth: '46m',
    type: 'Structure Rocheuse / Mérou',
    cert: '94.8%',
    label: 'Cap de Fer: 46m',
    positionClass: 'top-[25%] right-[23%]',
    color: 'amber',
  },
  {
    id: 'fosse',
    name: 'Fosse Golfe de Skikda',
    depth: '42m',
    type: 'Biomasse dense · Corridor Nord',
    cert: '98.1%',
    label: 'Fosse: 42m',
    positionClass: 'bottom-[26%] left-[58%]',
    color: 'teal',
  },
];

export const BentoDashboard: React.FC<BentoDashboardProps> = ({
  telemetry,
  biomassThreshold,
  lowPowerMode,
  headingApplied,
  gpsTracker,
  toolsConfig,
  activeZone = NAVIGATION_ZONES[0],
  autoLogCountdownSec,
  isAdmin = true,
  isCapturingPosition = false,
  onSaveCurrentPosition,
  onShareApp,
  onOpenQrShare,
  onSelectBlip,
  onRunMcpPipeline,
  onApplyHeading,
  onEnableHardwareHook,
  onConfigureAutoLog,
  onExportSetupJson,
  onSelectPlan,
  onNotify,
  onExport,
  onNavigateTab,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<RadarBlipTarget>(RADAR_BLIPS[0]);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const beamRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef(0);

  const effectiveTech = isAdmin && showTechDetails;

  useEffect(() => {
    let rafId = 0;
    const step = () => {
      angleRef.current = (angleRef.current + (lowPowerMode ? 0.55 : 1.25)) % 360;
      if (beamRef.current) {
        beamRef.current.style.transform = `rotate(${angleRef.current.toFixed(1)}deg)`;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [lowPowerMode]);

  const gainPct = Math.round(biomassThreshold * 100);

  return (
    <div className="space-y-5">
      {/* Top Sector Banner */}
      <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-center text-[#40dcca] shrink-0">
            {isAdmin ? <Bot className="w-5 h-5" /> : <Compass className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-[#e0fdff] truncate">
              <span>
                {effectiveTech ? `Agent MCP · ${activeZone.label}` : activeZone.label}
              </span>
            </div>
            <p className="text-xs font-mono text-[#9eb2b8] truncate tabular-nums">
              {effectiveTech
                ? `visionia_optimization.json · ${gpsTracker.sensor_id} (${gpsTracker.sampling_rate}) · Latence ${telemetry.bentoLatency} ms`
                : activeZone.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-right">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                telemetry.gnssSynced ? 'bg-[#40dcca] animate-pulse' : 'bg-[#ffba38]'
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-xs font-mono font-semibold ${
                telemetry.gnssSynced ? 'text-[#40dcca]' : 'text-[#ffba38]'
              }`}
            >
              {telemetry.gnssSynced ? 'GNSS Calibré' : 'GNSS Dérive'}
            </span>
          </div>
          {effectiveTech && (
            <span className="text-xs font-mono text-[#9eb2b8] tabular-nums">
              36°56.10&apos;N · 006°57.30&apos;E
            </span>
          )}
          <button
            type="button"
            onClick={onSaveCurrentPosition}
            disabled={isCapturingPosition}
            className="px-3.5 py-2 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] disabled:opacity-70 text-[#002022] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {isCapturingPosition ? 'Capture...' : 'Enregistrer ma position'}
            </span>
          </button>
          <button
            type="button"
            onClick={onShareApp}
            className="px-3 py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 text-[#00f2fe] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Partager l&apos;app</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowTechDetails((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showTechDetails
                  ? 'bg-[#232a34] border-[#00f2fe]/50 text-[#00f2fe]'
                  : 'bg-[#19202a] hover:bg-[#232a34] border-[#3a494b]/60 text-[#9eb2b8] hover:text-[#e0fdff]'
              }`}
              aria-pressed={showTechDetails}
            >
              {showTechDetails ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>{showTechDetails ? 'Vue Mer' : 'Détails tech'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-column Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Sonar Multifaisceaux HD */}
        <section className="lg:col-span-6 rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-[#00f2fe]" />
              <h2 className="text-base font-semibold text-[#e0fdff]">Sonar {activeZone.label}</h2>
            </div>
            {effectiveTech && (
              <span className="text-xs font-mono text-[#40dcca] tabular-nums">
                Auto-Detect · Seuil {gainPct}%
              </span>
            )}
          </div>

          <div className="relative w-full aspect-square max-h-[320px] mx-auto rounded-xl bg-[#080f18] border border-[#3a494b]/40 overflow-hidden flex items-center justify-center">
            <div className="absolute inset-4 rounded-full border border-[#40dcca]/15 pointer-events-none" />
            <div className="absolute inset-12 rounded-full border border-[#40dcca]/20 pointer-events-none" />
            <div className="absolute inset-20 rounded-full border border-[#40dcca]/25 pointer-events-none" />
            <div className="absolute inset-28 rounded-full border border-[#40dcca]/30 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#40dcca]/20 -translate-x-1/2 pointer-events-none" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-[#40dcca]/20 -translate-y-1/2 pointer-events-none" />

            {/* Rotating Beam */}
            <div ref={beamRef} className="absolute inset-0 origin-center pointer-events-none">
              <div
                className="w-1/2 h-1/2 origin-bottom-right"
                style={{
                  background:
                    'conic-gradient(from 180deg at 100% 100%, rgba(0, 242, 254, 0.42) 0deg, rgba(64, 220, 202, 0.14) 35deg, transparent 65deg)',
                }}
              />
            </div>

            {/* Own Vessel */}
            <div className="relative z-20 flex items-center justify-center w-7 h-7 rounded-full bg-[#232a34] border border-[#00f2fe]/40 text-[#e0fdff]">
              <Navigation className="w-3.5 h-3.5 text-[#00f2fe]" />
            </div>

            {/* Interactive Targets */}
            {RADAR_BLIPS.map((blip) => {
              const isSelected = selectedTarget.id === blip.id;
              const dotBg =
                blip.color === 'cyan'
                  ? 'bg-[#00f2fe]'
                  : blip.color === 'amber'
                    ? 'bg-[#ffba38]'
                    : 'bg-[#40dcca]';
              const textColor =
                blip.color === 'cyan'
                  ? 'text-[#00f2fe]'
                  : blip.color === 'amber'
                    ? 'text-[#ffba38]'
                    : 'text-[#e0fdff]';

              return (
                <button
                  key={blip.id}
                  type="button"
                  onClick={() => {
                    setSelectedTarget(blip);
                    onSelectBlip(blip);
                  }}
                  aria-label={`Cible ${blip.name} à ${blip.depth}`}
                  className={`absolute ${blip.positionClass} -translate-x-1/2 -translate-y-1/2 z-20 group focus:outline-none`}
                >
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    {isSelected && (
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotBg} opacity-55`}
                      />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${dotBg} ${
                        isSelected ? 'ring-2 ring-white/60' : ''
                      }`}
                    />
                  </span>
                  <span
                    className={`absolute left-4 -top-2 whitespace-nowrap px-1.5 py-0.5 rounded bg-[#19202a]/90 border border-[#3a494b]/60 ${textColor} font-mono text-[11px] pointer-events-none`}
                  >
                    {blip.label}
                  </span>
                </button>
              );
            })}

            {effectiveTech && (
              <>
                <div className="absolute top-2.5 left-3 font-mono text-[10px] text-[#9eb2b8] pointer-events-none">
                  Secteur DZ-SKI
                </div>
                <div className="absolute top-2.5 right-3 font-mono text-[10px] text-[#9eb2b8] pointer-events-none">
                  Balayage 360°
                </div>
                <div className="absolute bottom-2.5 left-3 font-mono text-[10px] text-[#40dcca] pointer-events-none">
                  455 kHz
                </div>
                <div className="absolute bottom-2.5 right-3 font-mono text-[10px] text-[#00f2fe] pointer-events-none tabular-nums">
                  Gain {gainPct}%
                </div>
              </>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#e0fdff] truncate">
                {selectedTarget.name} ({selectedTarget.depth})
              </div>
              <div className="text-xs text-[#9eb2b8] truncate">{selectedTarget.type}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-mono font-bold text-[#00f2fe] tabular-nums">
                {selectedTarget.cert}
              </div>
              <div className="text-[11px] text-[#9eb2b8]">Confiance</div>
            </div>
          </div>
        </section>

        {/* Right Column: Telemetry + Actions + Exports */}
        <div className="lg:col-span-6 flex flex-col gap-5 justify-between">
          {/* Navigation & System Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#e0fdff]">Navigation</h3>
                <Compass className="w-4 h-4 text-[#40dcca]" />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-[#9eb2b8]">Vitesse surface</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-4xl font-mono font-bold text-[#00f2fe] tabular-nums leading-none">
                      {telemetry.sog.toFixed(1)}
                    </span>
                    <span className="text-sm font-mono font-semibold text-[#40dcca]">kts</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#3a494b]/40">
                  <div>
                    <div className="text-xs text-[#9eb2b8]">Cap compas</div>
                    <div className="text-lg font-mono font-bold text-[#e0fdff] tabular-nums">
                      {String(telemetry.cog).padStart(3, '0')}° {getCardinal(telemetry.cog)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#9eb2b8]">Sondeur</div>
                    <div className="text-lg font-mono font-bold text-[#00f2fe] tabular-nums">
                      {telemetry.depth.toFixed(1)} m
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#e0fdff]">Système &amp; Énergie</h3>
                <BatteryCharging className="w-4 h-4 text-[#40dcca]" />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9eb2b8]">Batterie bord</span>
                    <span className="font-mono font-semibold text-[#40dcca] tabular-nums">
                      {telemetry.battery}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#232a34] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#40dcca] rounded-full"
                      style={{ width: `${telemetry.battery}%` }}
                    />
                  </div>
                </div>

                {effectiveTech ? (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#9eb2b8]">GPU Edge Ollama</span>
                      <span className="font-mono text-[#e0fdff] tabular-nums">
                        {telemetry.gpuLoad}% · {telemetry.gpuTemp}°C
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#232a34] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00f2fe] rounded-full transition-all duration-300"
                        style={{ width: `${telemetry.gpuLoad}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[#9eb2b8]">Calcul embarqué</span>
                    <span className="font-mono font-semibold text-[#40dcca]">Opérationnel</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#3a494b]/40">
                  <span className="flex items-center gap-1.5 text-[#9eb2b8]">
                    <Satellite className="w-3.5 h-3.5 text-[#40dcca]" />
                    <span>{effectiveTech ? 'NAVAREA III' : 'Réception Sat'}</span>
                  </span>
                  <span className="font-mono text-[#40dcca]">
                    {effectiveTech ? `Nominal · ${telemetry.fps} FPS` : 'Nominal'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution & Partage PWA Card (Bento Grid) */}
          <div className="rounded-xl bg-[#151c25] border border-[#00f2fe]/35 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#e0fdff]">
                  Partage &amp; Distribution PWA
                </h3>
                <p className="text-[11px] text-[#9eb2b8]">
                  {isAdmin
                    ? 'Distribuez Marina Visionnaire en Mode Invité par lien ou QR Code'
                    : 'Partagez Marina Visionnaire avec vos équipiers en un geste'}
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#40dcca] shrink-0">
                {isAdmin ? 'IS_ADMIN' : 'Mode Invité'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onShareApp}
                className="py-2.5 px-3.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager l&apos;application</span>
              </button>
              <button
                type="button"
                onClick={onOpenQrShare}
                className="py-2.5 px-3.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/50 text-[#40dcca] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                <span>QR Code d&apos;installation</span>
              </button>
            </div>
          </div>

          {/* Admin-only MCP Pipeline */}
          {isAdmin && (
            <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#e0fdff]">
                  Pipeline Tactique {activeZone.label}
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('agent-mcp-config')}
                  className="text-xs font-medium text-[#00f2fe] hover:underline whitespace-nowrap"
                >
                  {effectiveTech ? 'Ouvrir Console MCP' : 'Paramètres'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#19202a] border border-[#3a494b]/40">
                <div className="min-w-0">
                  {effectiveTech && (
                    <div className="text-xs font-mono text-[#40dcca]">
                      Priorité haute · /gnss_sync
                    </div>
                  )}
                  <div className="text-sm text-[#e0fdff] truncate">
                    {telemetry.gnssSynced
                      ? 'GNSS calibré sur Stora (±0.4 m)'
                      : 'Calibrer la localisation GNSS sur Stora'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRunMcpPipeline}
                  className="px-3.5 py-2 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {telemetry.gnssSynced
                      ? 'Re-calibrer'
                      : effectiveTech
                        ? 'Exécuter /gnss_sync'
                        : 'Calibrer GNSS'}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#19202a] border border-[#3a494b]/40">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#e0fdff] truncate">
                    Cap conseillé vers Cap de Fer
                  </div>
                  <div className="text-xs text-[#9eb2b8] truncate">
                    Évitement haut-fond Ras El Hadid (+6° tribord)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onApplyHeading}
                  disabled={headingApplied}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    headingApplied
                      ? 'bg-[#232a34] text-[#40dcca] cursor-default'
                      : 'bg-[#232a34] hover:bg-[#2e353f] text-[#e0fdff] border border-[#3a494b]'
                  }`}
                >
                  {headingApplied ? 'Cap appliqué' : 'Appliquer Cap'}
                </button>
              </div>
            </div>
          )}

          {/* Quick Mission Exports (clean client exports vs admin JSON extraction) */}
          <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#e0fdff]">
                Exportations {activeZone.label}
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('waypoints-nav')}
                className="text-xs text-[#9eb2b8] hover:text-[#e0fdff] whitespace-nowrap"
              >
                Gérer les waypoints
              </button>
            </div>
            <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
              <button
                type="button"
                onClick={() => onExport('PDF')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/40 transition-colors"
              >
                <FileText className="w-5 h-5 text-[#00f2fe]" />
                <span className="text-xs font-semibold text-[#e0fdff] mt-1.5">Export PDF</span>
                <span className="text-[11px] text-[#9eb2b8]">
                  {effectiveTech ? 'Rapport SHOM' : 'Rapport mer'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onExport('XLSX')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/40 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5 text-[#40dcca]" />
                <span className="text-xs font-semibold text-[#e0fdff] mt-1.5">Export XLSX</span>
                <span className="text-[11px] text-[#9eb2b8]">
                  {effectiveTech ? 'donnees_visionia' : 'Journal Excel'}
                </span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onExport('JSON')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/40 transition-colors"
                >
                  <Code2 className="w-5 h-5 text-[#ffba38]" />
                  <span className="text-xs font-semibold text-[#e0fdff] mt-1.5">Extraire JSON</span>
                  <span className="text-[11px] text-[#9eb2b8]">
                    {effectiveTech ? 'visionia_opt' : 'Sauvegarde'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Integrated React GPSWidget */}
      <GPSWidget
        tracker={gpsTracker}
        telemetry={telemetry}
        autoLogCountdownSec={autoLogCountdownSec}
        showTechDetails={effectiveTech}
        isAdmin={isAdmin}
        isCapturingPosition={isCapturingPosition}
        onSaveCurrentPosition={onSaveCurrentPosition}
        onEnableHardwareHook={onEnableHardwareHook}
        onConfigureAutoLog={onConfigureAutoLog}
        onExportSetupJson={onExportSetupJson}
        onExportXlsx={() => onExport('XLSX')}
      />

      {/* Integrated React Compas + GPS + AISStream */}
      <CompassGpsCard
        telemetry={telemetry}
        toolsConfig={toolsConfig}
        showTechDetails={effectiveTech}
        onSelectPlan={onSelectPlan}
        onNotify={onNotify}
      />
    </div>
  );
};
