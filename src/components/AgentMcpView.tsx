import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Copy,
  Cpu,
  CreditCard,
  Database,
  FileCode2,
  FileSpreadsheet,
  LayoutGrid,
  LocateFixed,
  Lock,
  Play,
  Power,
  Radar,
  Radio,
  RefreshCw,
  Satellite,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Terminal,
  Timer,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  AndroidLocationPermission,
  MarineFeatureKey,
  McpConfig,
  McpLogEntry,
  NmeaBaudRate,
  SubscriptionTier,
  TelemetryState,
  TrackPoint,
} from '../types/marine';
import { getTierLabel, hasAccess, isWeeklyPricingAnomalous } from '../utils/accessControl';

interface AgentMcpViewProps {
  config: McpConfig;
  isDirty: boolean;
  telemetry: TelemetryState;
  trackMemoire: TrackPoint[];
  logs: McpLogEntry[];
  cacheSizeMb: number;
  autoLogCountdownSec: number;
  onExecuteCommand: (cmd: string) => void;
  onExtractAndSaveJson: () => void;
  onExportXlsx: () => void;
  onExportSetupMarineGpsJson: () => void;
  onExportMarineToolsJson: () => void;
  onFocusGpsWidget: () => void;
  onFocusCompassGps: () => void;
  onOpenSyncScript: () => void;
  onReloadConfig: () => void;
  onTestInference: () => void;
  onToggleConfigFlag: (
    key: 'auto_pilot' | 'auto_export_nmea' | 'low_power_mode' | 'ai_transit_sleep'
  ) => void;
  onChangeBiomassThreshold: (pct: number) => void;
  onUpdateGeofence: (patch: Partial<McpConfig['geofence']>) => void;
  onUpdateGnssNmea: (patch: Partial<McpConfig['gnss_nmea']>) => void;
  onSelectPlan: (tier: SubscriptionTier) => void;
  onReviseWeeklyPrice: (priceEur: number) => void;
  onToggleFeatureTier: (feature: MarineFeatureKey) => void;
  onTestHasAccess: (feature: MarineFeatureKey) => void;
  onToggleConstellation: (key: 'gps' | 'glonass' | 'galileo') => void;
  onClearTrackMemoire: () => void;
  onPurgeCache: () => void;
  onUpdateCache: () => void;
  onCopyJson: () => void;
}

const PRESET_COMMANDS = [
  '/check_access --feature "ais_stream"',
  '/set_plan --tier "yearly"',
  '/revise_pricing --weekly "4.99"',
  '/system_hook --enable_sensor "GNSS_L5"',
  '/set_auto_log --format "xlsx" --interval "60s" --target "donnees_visionia.xlsx"',
  '/gnss_reset --force_on --update_interval 1000',
];

export const AgentMcpView: React.FC<AgentMcpViewProps> = ({
  config,
  isDirty,
  telemetry,
  trackMemoire,
  logs,
  cacheSizeMb,
  autoLogCountdownSec,
  onExecuteCommand,
  onExtractAndSaveJson,
  onExportXlsx,
  onExportSetupMarineGpsJson,
  onExportMarineToolsJson,
  onFocusGpsWidget,
  onFocusCompassGps,
  onOpenSyncScript,
  onReloadConfig,
  onTestInference,
  onToggleConfigFlag,
  onChangeBiomassThreshold,
  onUpdateGeofence,
  onUpdateGnssNmea,
  onSelectPlan,
  onReviseWeeklyPrice,
  onToggleFeatureTier,
  onTestHasAccess,
  onToggleConstellation,
  onClearTrackMemoire,
  onPurgeCache,
  onUpdateCache,
  onCopyJson,
}) => {
  const [cmdInput, setCmdInput] = useState('/check_access --feature "ais_stream"');
  const [actionGuideTab, setActionGuideTab] = useState<'plans' | 'gps-l5' | 'gnss' | 'skikda'>(
    'plans'
  );
  const [nmeaPortInput, setNmeaPortInput] = useState(config.gnss_nmea.nmea_port);
  const [nmeaBaudInput, setNmeaBaudInput] = useState<NmeaBaudRate>(config.gnss_nmea.baudrate);

  const sensitivityPct = Math.round(config.mcp_agent.biomass_threshold * 100);
  const cachePct = Math.min(100, Math.round((cacheSizeMb / 296) * 100));
  const memPct = Math.min(100, Math.round((telemetry.memoryBufferMb / 512) * 100));

  const gnss = config.gnss_nmea;
  const tracker = config.MARINE_GPS_TRACKER;
  const tools = config.marine_tools_config;
  const weeklyPlan = tools.plans.find((p) => p.id === 'weekly');
  const pricingAnomaly = isWeeklyPricingAnomalous(tools.plans);

  return (
    <div className="space-y-6">
      {/* Header Metrics Strip */}
      <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-center text-[#40dcca]">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#e0fdff]">
              Cockpit Agent MCP · {getTierLabel(tools.active_plan)}
            </h2>
            <p className="text-xs font-mono text-[#9eb2b8]">
              marine_tools_config.json · {tracker.sensor_id} ({tracker.sampling_rate}) ·{' '}
              {hasAccess('ais_stream', tools) ? 'AISStream déverrouillé' : 'AISStream verrouillé'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] font-mono text-[#9eb2b8]">Auto-Log Excel</div>
            <div
              className={`text-base font-mono font-bold tabular-nums ${
                tracker.auto_log_excel ? 'text-[#40dcca]' : 'text-[#9eb2b8]'
              }`}
            >
              {tracker.auto_log_excel
                ? `${autoLogCountdownSec}s / ${tracker.auto_log_interval_sec}s`
                : 'Manuel'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-[#9eb2b8]">HDOP / Fix</div>
            <div className="text-base font-mono font-bold text-[#00f2fe] tabular-nums">
              {telemetry.satellites.hdop.toFixed(1)} · {telemetry.satellites.fixType}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                config.mcp_agent.ai_transit_sleep ? 'bg-[#ffba38]' : 'bg-[#40dcca] animate-pulse'
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-xs font-mono font-semibold ${
                config.mcp_agent.ai_transit_sleep ? 'text-[#ffba38]' : 'text-[#40dcca]'
              }`}
            >
              {config.mcp_agent.ai_transit_sleep ? 'IA en veille' : 'Système OK'}
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Command Terminal, Recommended Actions, Subscriptions & hasAccess, GNSS/NMEA, Resource & Geofence */}
        <div className="lg:col-span-6 space-y-5">
          {/* MCP Command Terminal */}
          <section className="rounded-xl bg-[#151c25] border border-[#00f2fe]/30 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[#e0fdff]">Commandes Agentiques MCP</h3>
              <span className="text-xs font-mono text-[#00f2fe]">hasAccess · GNSS · Ollama</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onExecuteCommand(cmdInput);
              }}
              className="space-y-2.5"
            >
              <label htmlFor="mcp-cmd-input" className="block text-xs font-mono text-[#9eb2b8]">
                Commande (/check_access, /set_plan, /revise_pricing, /system_hook, /gnss_reset)
              </label>
              <div className="flex gap-2">
                <input
                  id="mcp-cmd-input"
                  type="text"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  className="flex-1 min-w-0 bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-xs font-mono text-[#00f2fe] focus:outline-none focus:border-[#00f2fe]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Exécuter</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_COMMANDS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCmdInput(preset)}
                    className="px-2 py-1 rounded bg-[#080f18] hover:bg-[#19202a] border border-[#3a494b]/60 text-[10px] font-mono text-[#9eb2b8] hover:text-[#e0fdff] transition-colors"
                  >
                    {preset.split(' ')[0]}
                  </button>
                ))}
              </div>
            </form>

            {/* Recommended MCP Actions with Guide Selector */}
            <div className="space-y-2.5 pt-2 border-t border-[#3a494b]/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#9eb2b8]">Actions MCP recommandées</span>
                <div className="flex flex-wrap items-center gap-1 bg-[#080f18] p-0.5 rounded-lg border border-[#3a494b]/50">
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('plans')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'plans'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Plans &amp; Accès
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('gps-l5')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'gps-l5'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    GNSS_L5
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('gnss')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'gnss'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    NMEA
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('skikda')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'skikda'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Skikda
                  </button>
                </div>
              </div>

              {actionGuideTab === 'plans' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onExtractAndSaveJson}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 1. Intégrer marine_tools_config.json
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Synchroniser dans visionia_optimization.json (plans + droits)
                      </div>
                    </div>
                    <Database className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onFocusCompassGps}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 2. Composant React Compas + GPS
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Inspecter DeviceOrientationEvent + GPS + verrouillage AISStream
                      </div>
                    </div>
                    <Compass className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onTestHasAccess('ais_stream')}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 3. Contrôle hasAccess(&apos;ais_stream&apos;)
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Vérifier le verrouillage AISStream (Gratuit vs Premium)
                      </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onReviseWeeklyPrice(4.99)}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 4. Réviser tarif Weekly ({weeklyPlan?.price_eur} EUR vs
                        Yearly 12.99 EUR)
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        {pricingAnomaly
                          ? 'Anomalie détectée : cliquer pour ajuster Weekly à 4.99 EUR'
                          : 'Tarification hebdomadaire révisée et cohérente'}
                      </div>
                    </div>
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        pricingAnomaly ? 'text-[#ffba38]' : 'text-[#40dcca]'
                      }`}
                    />
                  </button>
                </div>
              ) : actionGuideTab === 'gps-l5' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onExtractAndSaveJson}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 1. Mettre à jour visionia_optimization.json
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Inclut MARINE_GPS_TRACKER (GNSS_L5, 1Hz, buffer 25, 60s)
                      </div>
                    </div>
                    <Database className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/system_hook --enable_sensor "GNSS_L5"';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 2. /system_hook --enable_sensor &quot;GNSS_L5&quot;
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Activer le matériel GNSS_L5 pour le flux 1Hz
                      </div>
                    </div>
                    <Cpu className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onFocusGpsWidget}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 3. Afficher GPSWidget (useGNSSStream)
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Ouvrir le composant React connecté au flux 1Hz sur le Bento
                      </div>
                    </div>
                    <LayoutGrid className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd =
                        '/set_auto_log --format "xlsx" --interval "60s" --target "donnees_visionia.xlsx"';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 4. /set_auto_log → donnees_visionia.xlsx
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Automatiser l&apos;export des trajets toutes les 60s
                      </div>
                    </div>
                    <Timer className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onExportSetupMarineGpsJson}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité basse · 5. Générer setup_marine_gps.json
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Inclut MARINE_GPS_TRACKER et paramètres de bathymétrie
                      </div>
                    </div>
                    <FileCode2 className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>
                </div>
              ) : actionGuideTab === 'gnss' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/gnss_reset --force_on --update_interval 1000';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 1. /gnss_reset --force_on --update_interval 1000
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Réinitialiser le capteur GNSS (GPS, GLONASS, Galileo)
                      </div>
                    </div>
                    <Satellite className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd = `/connect_nmea --port ${nmeaPortInput} --baudrate ${nmeaBaudInput}`;
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 2. /connect_nmea --port {nmeaPortInput} --baudrate{' '}
                        {nmeaBaudInput}
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Configurer NMEA 0183 (4800 baud) ou AIS (38400 baud)
                      </div>
                    </div>
                    <Radio className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/get_status --gnss';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 3. /get_status --gnss
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Vérifier l&apos;état de la connexion satellite et l&apos;antenne
                      </div>
                    </div>
                    <Activity className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onOpenSyncScript}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité basse · 4. Script sync vers donnees_visionia.xlsx
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Générer l&apos;automatisation visionia_memoire → Excel
                      </div>
                    </div>
                    <FileCode2 className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/gnss_sync';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 1. Exécuter /gnss_sync
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Calibrer la localisation sur Stora et corriger la dérive carte
                      </div>
                    </div>
                    <LocateFixed className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/ollama --scan_area --radius "500m"';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 2. /ollama --scan_area --radius &quot;500m&quot;
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Analyser la bathymétrie cible et générer les waypoints IA
                      </div>
                    </div>
                    <Radar className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onExtractAndSaveJson}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 3. Extraire JSON (libérer mémoire)
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Exporter vers visionia_optimization.json ({telemetry.memoryBufferMb} Mo)
                      </div>
                    </div>
                    <Database className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/geofence --zone "Cap de Fer" --radius "800m" --enable';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité basse · 4. Configurer Geofence Cap de Fer
                      </div>
                      <div className="text-xs text-[#9eb2b8] truncate">
                        Périmètre sensible Cap de Fer · Ras El Hadid ({config.geofence.radius_m} m)
                      </div>
                    </div>
                    <ShieldAlert className="w-4 h-4 text-[#ffb4ab] shrink-0" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Subscriptions, Pricing Revision & hasAccess Matrix */}
          <section className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#00f2fe]" />
                <h3 className="text-base font-semibold text-[#e0fdff]">
                  Plans &amp; Contrôle <code className="text-[#40dcca]">hasAccess</code>
                </h3>
              </div>
              <button
                type="button"
                onClick={onExportMarineToolsJson}
                className="text-xs font-mono text-[#00f2fe] hover:underline"
              >
                marine_tools_config.json
              </button>
            </div>

            {/* Active Plan Selector: Free + 3 Paid Plans */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onSelectPlan('free')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  tools.active_plan === 'free'
                    ? 'bg-[#19202a] border-[#00f2fe] text-[#e0fdff]'
                    : 'bg-[#080f18] border-[#3a494b]/50 text-[#9eb2b8]'
                }`}
              >
                <div className="text-xs font-semibold">Gratuit</div>
                <div className="text-[11px] font-mono text-[#9eb2b8]">0.00 EUR</div>
              </button>
              {tools.plans.map((plan) => {
                const isActive = tools.active_plan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => onSelectPlan(plan.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      isActive
                        ? 'bg-[#19202a] border-[#40dcca] text-[#e0fdff]'
                        : 'bg-[#080f18] border-[#3a494b]/50 text-[#9eb2b8]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{plan.label}</div>
                    <div className="text-[11px] font-mono text-[#40dcca] tabular-nums">
                      {plan.price_eur.toFixed(2)} EUR
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Weekly vs Yearly Pricing Audit */}
            <div
              className={`p-3.5 rounded-lg border space-y-2 ${
                pricingAnomaly
                  ? 'bg-[#ffba38]/10 border-[#ffba38]/40'
                  : 'bg-[#19202a] border-[#40dcca]/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#e0fdff] flex items-center gap-1.5">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 ${
                      pricingAnomaly ? 'text-[#ffba38]' : 'text-[#40dcca]'
                    }`}
                  />
                  <span>
                    Audit Tarification Weekly ({weeklyPlan?.price_eur.toFixed(2)} EUR) vs Yearly (12.99
                    EUR)
                  </span>
                </span>
                <span className="font-mono text-[11px] text-[#40dcca]">
                  {pricingAnomaly ? 'À réviser' : 'Cohérent'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="weekly-price-input" className="text-[11px] text-[#9eb2b8]">
                  Tarif Weekly (EUR) :
                </label>
                <input
                  id="weekly-price-input"
                  type="number"
                  step="0.50"
                  min="0.99"
                  value={weeklyPlan?.price_eur ?? 31.99}
                  onChange={(e) => onReviseWeeklyPrice(parseFloat(e.target.value) || 4.99)}
                  className="w-24 bg-[#080f18] border border-[#3a494b] rounded px-2 py-1 text-xs font-mono text-[#e0fdff]"
                />
                {pricingAnomaly && (
                  <button
                    type="button"
                    onClick={() => onReviseWeeklyPrice(4.99)}
                    className="px-2.5 py-1 rounded bg-[#ffba38] hover:bg-[#ffd491] text-[#002022] text-[11px] font-semibold"
                  >
                    Corriger à 4.99 EUR
                  </button>
                )}
              </div>
            </div>

            {/* hasAccess Feature Entitlements Table */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-[#9eb2b8]">
                Permissions conditionnelles (`hasAccess`)
              </div>
              {(Object.keys(tools.features) as MarineFeatureKey[]).map((key) => {
                const rule = tools.features[key];
                const granted = hasAccess(key, tools);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 text-xs"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {granted ? (
                        <Unlock className="w-3.5 h-3.5 text-[#40dcca] shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-[#ffba38] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[#e0fdff] truncate">{rule.label}</div>
                        <div className="text-[10px] font-mono text-[#9eb2b8]">
                          hasAccess(&apos;{key}&apos;) →{' '}
                          <span className={granted ? 'text-[#40dcca]' : 'text-[#ffb4ab]'}>
                            {String(granted)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleFeatureTier(key)}
                      className={`px-2.5 py-1 rounded font-mono text-[10px] border shrink-0 ${
                        rule.required_tier === 'premium'
                          ? 'bg-[#080f18] border-[#ffba38]/50 text-[#ffba38]'
                          : 'bg-[#080f18] border-[#40dcca]/40 text-[#40dcca]'
                      }`}
                    >
                      {rule.required_tier.toUpperCase()}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* GNSS, Android, Antenna & NMEA 0183 / AIS Section */}
          <section className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-[#00f2fe]" />
                <h3 className="text-base font-semibold text-[#e0fdff]">
                  Configuration GNSS &amp; Protocole NMEA
                </h3>
              </div>
              <span className="text-xs font-mono text-[#40dcca] tabular-nums">
                {gnss.update_interval_ms} ms
              </span>
            </div>

            {/* Constellations GPS / GLONASS / Galileo */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'gps', label: 'GPS', count: telemetry.satellites.gps },
                  { id: 'glonass', label: 'GLONASS', count: telemetry.satellites.glonass },
                  { id: 'galileo', label: 'Galileo', count: telemetry.satellites.galileo },
                ] as const
              ).map((c) => {
                const enabled = gnss.constellations[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onToggleConstellation(c.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      enabled
                        ? 'bg-[#19202a] border-[#40dcca]/50 text-[#e0fdff]'
                        : 'bg-[#080f18] border-[#3a494b]/40 text-[#9eb2b8]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold">{c.label}</span>
                      <span className={enabled ? 'text-[#40dcca]' : 'text-[#9eb2b8]'}>
                        {enabled ? `${c.count} sats` : 'OFF'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Android Location Permission */}
            <div className="p-3.5 rounded-lg bg-[#19202a] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-[#e0fdff]">
                  <Smartphone className="w-4 h-4 text-[#40dcca]" />
                  <span>Autorisation Position Android</span>
                </div>
                <select
                  aria-label="Autorisation position Android"
                  value={gnss.android_permission}
                  onChange={(e) =>
                    onUpdateGnssNmea({
                      android_permission: e.target.value as AndroidLocationPermission,
                    })
                  }
                  className="bg-[#080f18] border border-[#3a494b] rounded-md px-2.5 py-1 text-xs font-mono text-[#00f2fe]"
                >
                  <option value="always">Toujours autoriser</option>
                  <option value="while_using">Uniquement si active</option>
                  <option value="denied">Refusée</option>
                </select>
              </div>
              <p
                className={`text-[11px] ${
                  gnss.android_permission === 'always' ? 'text-[#9eb2b8]' : 'text-[#ffb4ab]'
                }`}
              >
                {gnss.android_permission === 'always'
                  ? 'Autorisation "Toujours autoriser" active : acquisition continue en arrière-plan.'
                  : 'Attention : sous Android, sélectionnez "Toujours autoriser" pour éviter les coupures GNSS.'}
              </p>
            </div>

            {/* Antenna Clearance */}
            <div className="p-3.5 rounded-lg bg-[#19202a] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#e0fdff]">
                  Dégagement Antenne GNSS (Ciel libre)
                </div>
                <div className="text-[11px] text-[#9eb2b8]">
                  {gnss.antenna_clear_sky
                    ? `Signal dégagé · HDOP ${telemetry.satellites.hdop.toFixed(1)} · Réception optimale`
                    : 'Antenne obstruée · Réflexions multivoies / perte de fix'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={gnss.antenna_clear_sky}
                onClick={() => onUpdateGnssNmea({ antenna_clear_sky: !gnss.antenna_clear_sky })}
                className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${
                  gnss.antenna_clear_sky ? 'bg-[#40dcca]' : 'bg-[#93000a]'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform ${
                    gnss.antenna_clear_sky
                      ? 'translate-x-5 bg-[#002022]'
                      : 'translate-x-0 bg-[#ffb4ab]'
                  }`}
                />
              </button>
            </div>

            {/* NMEA 0183 (4800) / AIS (38400) Port Config */}
            <div className="p-3.5 rounded-lg bg-[#19202a] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#e0fdff]">Port Série NMEA &amp; Vitesse</span>
                <span
                  className={`font-mono ${
                    gnss.nmea_connected ? 'text-[#40dcca]' : 'text-[#ffb4ab]'
                  }`}
                >
                  {gnss.nmea_connected ? 'Connecté' : 'Hors ligne'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  aria-label="Chemin du port NMEA"
                  value={nmeaPortInput}
                  onChange={(e) => setNmeaPortInput(e.target.value)}
                  placeholder="/dev/ttyUSB0"
                  className="flex-1 min-w-[140px] bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#e0fdff]"
                />
                <button
                  type="button"
                  onClick={() => setNmeaBaudInput(4800)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                    nmeaBaudInput === 4800
                      ? 'bg-[#00f2fe] border-[#00f2fe] text-[#002022] font-semibold'
                      : 'bg-[#080f18] border-[#3a494b] text-[#9eb2b8]'
                  }`}
                >
                  4800 baud (NMEA 0183)
                </button>
                <button
                  type="button"
                  onClick={() => setNmeaBaudInput(38400)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                    nmeaBaudInput === 38400
                      ? 'bg-[#00f2fe] border-[#00f2fe] text-[#002022] font-semibold'
                      : 'bg-[#080f18] border-[#3a494b] text-[#9eb2b8]'
                  }`}
                >
                  38400 baud (AIS {!hasAccess('ais_stream', tools) ? '· Premium' : ''})
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 bg-[#080f18] border border-[#3a494b]/50 rounded px-2.5 py-1.5 font-mono text-[10px] text-[#40dcca] truncate">
                  {telemetry.nmeaSentence}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cmd = `/connect_nmea --port ${nmeaPortInput.trim() || '/dev/ttyUSB0'} --baudrate ${nmeaBaudInput}`;
                    setCmdInput(cmd);
                    onExecuteCommand(cmd);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#40dcca]/40 text-xs font-medium text-[#e0fdff] whitespace-nowrap shrink-0"
                >
                  Connecter NMEA
                </button>
              </div>
            </div>

            {/* Local Track Storage: visionia_memoire */}
            <div className="p-3.5 rounded-lg bg-[#19202a] space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-[#e0fdff]">
                    Enregistrement trajets : <code className="text-[#00f2fe]">visionia_memoire</code>
                  </div>
                  <div className="text-[11px] font-mono text-[#9eb2b8] tabular-nums">
                    {trackMemoire.length} point(s) enregistré(s) localement
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={gnss.record_to_memoire}
                  onClick={() => onUpdateGnssNmea({ record_to_memoire: !gnss.record_to_memoire })}
                  className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${
                    gnss.record_to_memoire ? 'bg-[#40dcca]' : 'bg-[#2e353f]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full transition-transform ${
                      gnss.record_to_memoire
                        ? 'translate-x-5 bg-[#002022]'
                        : 'translate-x-0 bg-[#9eb2b8]'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onExportXlsx}
                  className="px-2.5 py-1.5 rounded-lg bg-[#080f18] hover:bg-[#232a34] border border-[#40dcca]/40 text-[11px] font-medium text-[#40dcca] flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Sync donnees_visionia.xlsx</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSyncScript}
                  className="px-2.5 py-1.5 rounded-lg bg-[#080f18] hover:bg-[#232a34] border border-[#3a494b] text-[11px] font-medium text-[#e0fdff] flex items-center gap-1"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-[#00f2fe]" />
                  <span>Script Auto-Sync</span>
                </button>
                <button
                  type="button"
                  onClick={onClearTrackMemoire}
                  className="px-2.5 py-1.5 rounded-lg bg-[#080f18] hover:bg-[#232a34] border border-[#3a494b] text-[11px] font-medium text-[#ffb4ab] flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider</span>
                </button>
              </div>
            </div>
          </section>

          {/* Resource Management & Geofence Configuration */}
          <section className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#40dcca]" />
              <h3 className="text-base font-semibold text-[#e0fdff]">
                Ressources IA &amp; Geofence Cap de Fer
              </h3>
            </div>

            <div className="p-3.5 rounded-lg bg-[#19202a] flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Power className="w-4 h-4 text-[#ffba38] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-[#e0fdff]">
                    Désactiver l&apos;IA lors des déplacements
                  </div>
                  <div className="text-[11px] text-[#9eb2b8]">
                    Met Ollama en veille durant le transit pour réduire la charge GPU (
                    {telemetry.gpuLoad}%).
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.mcp_agent.ai_transit_sleep}
                onClick={() => onToggleConfigFlag('ai_transit_sleep')}
                className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${
                  config.mcp_agent.ai_transit_sleep ? 'bg-[#ffba38]' : 'bg-[#2e353f]'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform ${
                    config.mcp_agent.ai_transit_sleep
                      ? 'translate-x-5 bg-[#002022]'
                      : 'translate-x-0 bg-[#9eb2b8]'
                  }`}
                />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-[#19202a] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-[#e0fdff]">Mémoire Tampon Waypoints &amp; Scan</div>
                  <div className="text-[11px] text-[#9eb2b8]">
                    Libérée lors de l&apos;extraction JSON
                  </div>
                </div>
                <span className="font-mono font-semibold text-[#ffba38] tabular-nums">
                  {telemetry.memoryBufferMb} / 512 Mo
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#2e353f] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    telemetry.memoryBufferMb > 300 ? 'bg-[#ffba38]' : 'bg-[#40dcca]'
                  }`}
                  style={{ width: `${memPct}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#19202a] border border-[#ffb4ab]/30 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[#e0fdff]">
                    Geofence : {config.geofence.zone_name}
                  </div>
                  <div className="text-[11px] font-mono text-[#9eb2b8]">
                    {config.geofence.lat.toFixed(3)}°N · {config.geofence.lon.toFixed(3)}°E
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.geofence.enabled}
                  onClick={() => onUpdateGeofence({ enabled: !config.geofence.enabled })}
                  className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${
                    config.geofence.enabled ? 'bg-[#ffb4ab]' : 'bg-[#2e353f]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full transition-transform ${
                      config.geofence.enabled
                        ? 'translate-x-5 bg-[#002022]'
                        : 'translate-x-0 bg-[#9eb2b8]'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label htmlFor="geofence-radius" className="text-[#9eb2b8]">
                    Rayon de garde Cap de Fer
                  </label>
                  <span className="font-mono font-semibold text-[#ffb4ab] tabular-nums">
                    {config.geofence.radius_m} m
                  </span>
                </div>
                <input
                  id="geofence-radius"
                  type="range"
                  min={300}
                  max={2000}
                  step={100}
                  value={config.geofence.radius_m}
                  onChange={(e) => onUpdateGeofence({ radius_m: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#2e353f] rounded-lg accent-[#ffb4ab] cursor-pointer"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#19202a] space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="sonar-sensitivity" className="text-[#e0fdff] font-medium">
                  Sensibilité Détection Biomasse
                </label>
                <span className="font-mono font-bold text-[#40dcca] tabular-nums">
                  {sensitivityPct}%
                </span>
              </div>
              <input
                id="sonar-sensitivity"
                type="range"
                min={30}
                max={100}
                value={sensitivityPct}
                onChange={(e) => onChangeBiomassThreshold(Number(e.target.value))}
                className="w-full h-1.5 bg-[#2e353f] rounded-lg accent-[#40dcca] cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-lg bg-[#19202a] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#e0fdff]">Mode Basse Consommation</div>
                <div className="text-[11px] text-[#9eb2b8]">
                  Réduit l&apos;échantillonnage à 5 FPS pour préserver les batteries.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.mcp_agent.low_power_mode}
                onClick={() => onToggleConfigFlag('low_power_mode')}
                className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${
                  config.mcp_agent.low_power_mode ? 'bg-[#40dcca]' : 'bg-[#2e353f]'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform ${
                    config.mcp_agent.low_power_mode
                      ? 'translate-x-5 bg-[#002022]'
                      : 'translate-x-0 bg-[#9eb2b8]'
                  }`}
                />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-[#19202a] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-[#e0fdff]">
                    Cache Cartographique Golfe de Skikda
                  </div>
                  <div className="text-[11px] text-[#9eb2b8]">
                    Dalles Stora · Port Skikda · Cap de Fer
                  </div>
                </div>
                <span className="font-mono font-semibold text-[#00f2fe] tabular-nums">
                  {cacheSizeMb} Mo
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#2e353f] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00f2fe] rounded-full transition-all duration-300"
                  style={{ width: `${cachePct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[#9eb2b8] tabular-nums">{cachePct}% alloué</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onPurgeCache}
                    className="text-[#ffb4ab] hover:underline"
                  >
                    Vider
                  </button>
                  <button
                    type="button"
                    onClick={onUpdateCache}
                    className="text-[#40dcca] hover:underline"
                  >
                    Mettre à jour
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: visionia_optimization.json & Streaming Event Log */}
        <div className="lg:col-span-6 space-y-5">
          {/* JSON Config Manager */}
          <section className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[#e0fdff]">visionia_optimization.json</h3>
              <span
                className={`text-xs font-mono font-semibold ${
                  isDirty ? 'text-[#ffba38]' : 'text-[#40dcca]'
                }`}
              >
                {isDirty ? 'Modifié' : 'Synchronisé'}
              </span>
            </div>

            <div className="bg-[#080f18] border border-[#3a494b]/50 rounded-lg p-3">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3a494b]/40">
                <span className="text-[11px] font-mono text-[#9eb2b8]">
                  Config Runtime ({config.points_navigation.length} pts · marine_tools_config +
                  MARINE_GPS_TRACKER)
                </span>
                <button
                  type="button"
                  onClick={onCopyJson}
                  className="flex items-center gap-1 text-xs font-mono text-[#40dcca] hover:text-[#e0fdff]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-[#dce3f0] leading-relaxed max-h-64 overflow-y-auto overflow-x-auto select-all">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onToggleConfigFlag('auto_pilot')}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/40 text-xs font-mono"
              >
                <span className="text-[#dce3f0]">auto_pilot</span>
                <span className={config.mcp_agent.auto_pilot ? 'text-[#40dcca]' : 'text-[#ffb4ab]'}>
                  {String(config.mcp_agent.auto_pilot).toUpperCase()}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onToggleConfigFlag('auto_export_nmea')}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/40 text-xs font-mono"
              >
                <span className="text-[#dce3f0]">auto_export_nmea</span>
                <span
                  className={
                    config.mcp_agent.auto_export_nmea ? 'text-[#40dcca]' : 'text-[#ffb4ab]'
                  }
                >
                  {String(config.mcp_agent.auto_export_nmea).toUpperCase()}
                </span>
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onExtractAndSaveJson}
                className="w-full py-2.5 px-4 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Extraire JSON &amp; Libérer Mémoire</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onReloadConfig}
                  className="py-2 px-3 rounded-lg bg-[#232a34] hover:bg-[#2e353f] text-xs font-medium text-[#e0fdff] flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Recharger</span>
                </button>
                <button
                  type="button"
                  onClick={onTestInference}
                  className="py-2 px-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/40 text-xs font-medium text-[#40dcca] flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Tester Inférence</span>
                </button>
              </div>
            </div>
          </section>

          {/* Streaming Event Log */}
          <section className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#e0fdff]">Journal d&apos;Événements MCP</h3>
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#40dcca]">
                <span className="w-2 h-2 rounded-full bg-[#40dcca] animate-pulse" aria-hidden="true" />
                <span>Streaming</span>
              </div>
            </div>

            <div className="bg-[#080f18] border border-[#3a494b]/50 rounded-lg p-3 max-h-72 overflow-y-auto space-y-2">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2.5 p-2 rounded hover:bg-[#151c25] transition-colors text-xs"
                >
                  <span className="font-mono text-[#00f2fe] shrink-0 tabular-nums">
                    [{entry.time}]
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[#e0fdff]">
                      <span className="text-[#40dcca] font-semibold">{entry.tag}</span>
                      <span className="text-[#9eb2b8]"> · </span>
                      <span>{entry.source}</span>
                    </div>
                    <div className="text-[#9eb2b8] break-words mt-0.5">{entry.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
