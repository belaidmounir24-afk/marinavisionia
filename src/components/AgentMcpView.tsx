import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Copy,
  Cpu,
  CreditCard,
  Crown,
  Database,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Globe,
  KeyRound,
  LayoutGrid,
  LocateFixed,
  Lock,
  Mail,
  MapPin,
  MapPinPlus,
  Phone,
  Play,
  Power,
  QrCode,
  Radar,
  Radio,
  RefreshCw,
  Satellite,
  Save,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Terminal,
  Timer,
  Trash2,
  Unlock,
  UserCheck,
} from 'lucide-react';
import {
  AndroidLocationPermission,
  LocalRagIndex,
  ManualLicenseRecord,
  MarineFeatureKey,
  McpConfig,
  McpLogEntry,
  NmeaBaudRate,
  PointInteretMed,
  PwaDeployConfig,
  SubscriptionTier,
  TelemetryState,
  TrackPoint,
} from '../types/marine';
import {
  getTierLabel,
  hasAccess,
  PROJECT_CONTACT,
  TURNKEY_LICENSE_PRESETS,
} from '../utils/accessControl';
import {
  calculateGpsDistance,
  queryLocalRagIndex,
  VESSEL_LAT,
  VESSEL_LON,
} from '../utils/navigation';
import { PwaDeployPanel } from './PwaDeployPanel';

interface AgentMcpViewProps {
  config: McpConfig;
  isDirty: boolean;
  telemetry: TelemetryState;
  trackMemoire: TrackPoint[];
  logs: McpLogEntry[];
  cacheSizeMb: number;
  autoLogCountdownSec: number;
  manualLicense: ManualLicenseRecord;
  pointsInteret: PointInteretMed[];
  ragIndex: LocalRagIndex;
  isAdmin: boolean;
  onToggleAdminMode: (nextAdmin: boolean) => void;
  onShareApp: (guestMode?: boolean) => void;
  onOpenQrShare: (guestMode?: boolean) => void;
  onDownloadManifest: () => void;
  onExecuteCommand: (cmd: string) => void;
  onExtractAndSaveJson: () => void;
  onExportXlsx: () => void;
  onExportSetupMarineGpsJson: () => void;
  onExportMarineToolsJson: () => void;
  onExportMedPoisJson: () => void;
  onExportLieuxNavJson: () => void;
  onExportPdf: () => void;
  onIndexRagDatabase: () => void;
  onOpenImplScriptModal: (lang: 'javascript' | 'python') => void;
  onOpenNavView: () => void;
  onOpenManualPoint: () => void;
  onCapturePoiFromGnrmc: () => void;
  onTogglePoiAiAlert: (poiId: string) => void;
  onActivateLicenseCode: (code: string, provider?: 'Manuel' | 'Stripe' | 'PayPal') => void;
  onRevokeLicense: () => void;
  onPurchaseTurnkey: (provider: 'Stripe' | 'PayPal', tier: Exclude<SubscriptionTier, 'free'>) => void;
  onFocusBento: () => void;
  onFocusGpsWidget: () => void;
  onFocusCompassGps: () => void;
  onOpenPasserelle: () => void;
  onSaveCurrentPosition: () => void;
  onOpenSyncScript: () => void;
  onReloadConfig: () => void;
  onTestInference: () => void;
  onToggleConfigFlag: (
    key: 'auto_pilot' | 'auto_export_nmea' | 'low_power_mode' | 'ai_transit_sleep'
  ) => void;
  onChangeBiomassThreshold: (pct: number) => void;
  onUpdateGeofence: (patch: Partial<McpConfig['geofence']>) => void;
  onUpdateGnssNmea: (patch: Partial<McpConfig['gnss_nmea']>) => void;
  onUpdatePwaDeploy: (patch: Partial<PwaDeployConfig>) => void;
  onSyncNetlify: () => void;
  onExportNetlifyToml: () => void;
  onNotify: (msg: string) => void;
  onLog: (tag: string, source: string, detail: string) => void;
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
  '/set_mode --guest',
  '/share_app',
  '/gen_qrcode',
  '/memoire --note "Validation Marina Visionnaire · Mode Invité & PWA"',
  '/pdf',
  '/excel',
  '/set_zone --zone "skikda"',
  '/add_point --name "Cap de Fer" --lat 37.0815 --lon 7.1720',
];

export const AgentMcpView: React.FC<AgentMcpViewProps> = ({
  config,
  isDirty,
  telemetry,
  trackMemoire,
  logs,
  cacheSizeMb,
  autoLogCountdownSec,
  manualLicense,
  pointsInteret,
  ragIndex,
  isAdmin,
  onToggleAdminMode,
  onShareApp,
  onOpenQrShare,
  onDownloadManifest,
  onExecuteCommand,
  onExtractAndSaveJson,
  onExportXlsx,
  onExportSetupMarineGpsJson,
  onExportMarineToolsJson,
  onExportMedPoisJson,
  onExportLieuxNavJson,
  onExportPdf,
  onIndexRagDatabase,
  onOpenImplScriptModal,
  onOpenNavView,
  onOpenManualPoint,
  onCapturePoiFromGnrmc,
  onTogglePoiAiAlert,
  onActivateLicenseCode,
  onRevokeLicense,
  onPurchaseTurnkey,
  onFocusBento,
  onFocusGpsWidget,
  onFocusCompassGps,
  onOpenPasserelle,
  onSaveCurrentPosition,
  onOpenSyncScript,
  onReloadConfig,
  onTestInference,
  onToggleConfigFlag,
  onChangeBiomassThreshold,
  onUpdateGeofence,
  onUpdateGnssNmea,
  onUpdatePwaDeploy,
  onSyncNetlify,
  onExportNetlifyToml,
  onNotify,
  onLog,
  onSelectPlan,
  onToggleFeatureTier,
  onTestHasAccess,
  onToggleConstellation,
  onClearTrackMemoire,
  onPurgeCache,
  onUpdateCache,
  onCopyJson,
}) => {
  const [cmdInput, setCmdInput] = useState(
    '/set_mode --guest'
  );
  const [actionGuideTab, setActionGuideTab] = useState<
    | 'distribution'
    | 'synthese'
    | 'mediterranee-db'
    | 'lieux-nav'
    | 'freemium'
    | 'gps-pin'
    | 'ux'
    | 'pwa'
    | 'plans'
    | 'gps-l5'
    | 'gnss'
    | 'skikda'
  >('distribution');
  const [licenseInput, setLicenseInput] = useState(manualLicense.code || 'MV-1Y-2026');
  const [nmeaPortInput, setNmeaPortInput] = useState(config.gnss_nmea.nmea_port);
  const [nmeaBaudInput, setNmeaBaudInput] = useState<NmeaBaudRate>(config.gnss_nmea.baudrate);
  const [ragQuery, setRagQuery] = useState('');
  const [refLatInput, setRefLatInput] = useState(VESSEL_LAT.toFixed(4));
  const [refLonInput, setRefLonInput] = useState(VESSEL_LON.toFixed(4));

  const sensitivityPct = Math.round(config.mcp_agent.biomass_threshold * 100);
  const cachePct = Math.min(100, Math.round((cacheSizeMb / 296) * 100));
  const memPct = Math.min(100, Math.round((telemetry.memoryBufferMb / 512) * 100));

  const gnss = config.gnss_nmea;
  const tracker = config.MARINE_GPS_TRACKER;
  const tools = config.marine_tools_config;
  const contact = config.project_contact || PROJECT_CONTACT;

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

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
                    onClick={() => setActionGuideTab('distribution')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'distribution'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Mode Invité &amp; PWA
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('synthese')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'synthese'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Synthèse Projet
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('mediterranee-db')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'mediterranee-db'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Méditerranée RAG
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('lieux-nav')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'lieux-nav'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Lieux &amp; Nav
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('freemium')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'freemium'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Freemium &amp; POI
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('gps-pin')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'gps-pin'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    Capture GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('ux')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'ux'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    UI/UX Mer
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionGuideTab('pwa')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      actionGuideTab === 'pwa'
                        ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                        : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    PWA &amp; CI/CD
                  </button>
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

              {actionGuideTab === 'distribution' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onDownloadManifest}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#00f2fe]">
                        Priorité haute · 1. Configurer manifest.json (PWA)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Marina Visionnaire · start_url /?mode=guest · standalone · icônes 192/512 + maskable
                      </div>
                    </div>
                    <Smartphone className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleAdminMode(!isAdmin)}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité haute · 2. Variable IS_ADMIN = {String(isAdmin)} (Mode Invité)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Isoler l&apos;admin du client final · masquer consoles MCP, JSON &amp; outils d&apos;édition
                      </div>
                    </div>
                    <UserCheck className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onShareApp(true)}
                      className="p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-2 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[#00f2fe]">
                          Priorité moyenne · 3. partagerApp()
                        </div>
                        <div className="text-[11px] text-[#9eb2b8] break-words">
                          Partage mobile navigator.share (Bento Grid)
                        </div>
                      </div>
                      <Share2 className="w-4 h-4 text-[#00f2fe] shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenQrShare(true)}
                      className="p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-2 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[#ffba38]">
                          Priorité basse · 4. QR Code PWA
                        </div>
                        <div className="text-[11px] text-[#9eb2b8] break-words">
                          Générer &amp; télécharger QR Code (?mode=guest)
                        </div>
                      </div>
                      <QrCode className="w-4 h-4 text-[#ffba38] shrink-0" />
                    </button>
                  </div>
                </div>
              ) : actionGuideTab === 'synthese' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cmd =
                        '/memoire --note "Contexte MarineVision AI validé : +213 6 97 29 60 59 · belaid.mounir.40@gmail.com · 20€/50€/100€ · Méditerranée"';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#00f2fe]">
                        Priorité haute · 1. Exécuter /memoire (persistance visionia_memoire)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Valide contact ({contact.phone} · {contact.email}), tarifs (20 € / 50 € / 100 €) et schéma GPS lat/lon
                      </div>
                    </div>
                    <Database className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onExportPdf}
                      className="p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-2 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[#ffba38]">
                          Priorité moyenne · 2a. /pdf
                        </div>
                        <div className="text-[11px] text-[#9eb2b8] break-words">
                          Rapport structure &amp; tarifs PDF
                        </div>
                      </div>
                      <FileText className="w-4 h-4 text-[#ffba38] shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={onExportXlsx}
                      className="p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-2 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[#40dcca]">
                          Priorité moyenne · 2b. /excel
                        </div>
                        <div className="text-[11px] text-[#9eb2b8] break-words">
                          Archivage donnees_visionia.xlsx
                        </div>
                      </div>
                      <FileSpreadsheet className="w-4 h-4 text-[#40dcca] shrink-0" />
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-[#19202a] border border-[#40dcca]/45 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité haute · 3. Définir 1ère zone géographique cible &amp; POI
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const cmd = '/set_zone --zone "skikda"';
                          setCmdInput(cmd);
                          onExecuteCommand(cmd);
                        }}
                        className="px-2.5 py-1.5 rounded bg-[#080f18] hover:bg-[#232a34] border border-[#00f2fe]/40 text-[11px] font-mono text-[#00f2fe]"
                      >
                        /set_zone skikda
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cmd = '/set_zone --zone "mediterranee"';
                          setCmdInput(cmd);
                          onExecuteCommand(cmd);
                        }}
                        className="px-2.5 py-1.5 rounded bg-[#080f18] hover:bg-[#232a34] border border-[#40dcca]/40 text-[11px] font-mono text-[#40dcca]"
                      >
                        /set_zone mediterranee
                      </button>
                      <button
                        type="button"
                        onClick={onOpenManualPoint}
                        className="px-2.5 py-1.5 rounded bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-[11px] font-bold flex items-center gap-1 ml-auto"
                      >
                        <MapPinPlus className="w-3.5 h-3.5" />
                        <span>+ Ajouter POI (/add_point)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : actionGuideTab === 'mediterranee-db' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onIndexRagDatabase}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#00f2fe]">
                        Priorité haute · 1. Mémoriser &amp; indexer dans le RAG local
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        {ragIndex.total_docs} fiches unifiées (Skikda, Marseille, Maddalena, Lavezzi, Cap Bon, Kornati, Costa Brava, Al Hoceïma)
                      </div>
                    </div>
                    <Database className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById('med-poi-panel')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité moyenne · 2. Calcul dynamique de distance GPS (Haversine)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Calcul temps réel entre position GPS / libre et les {pointsInteret.length} POI Méditerranée
                      </div>
                    </div>
                    <LocateFixed className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenImplScriptModal('javascript')}
                      className="p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-2 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[#ffba38]">
                          Priorité moyenne · 3a. Script JS
                        </div>
                        <div className="text-[11px] text-[#9eb2b8] break-words">
                          Menu sélection + Haversine JS
                        </div>
                      </div>
                      <FileCode2 className="w-4 h-4 text-[#ffba38] shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenImplScriptModal('python')}
                      className="p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-2 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-[#40dcca]">
                          Priorité moyenne · 3b. Script Python
                        </div>
                        <div className="text-[11px] text-[#9eb2b8] break-words">
                          Menu sélection + Haversine .py
                        </div>
                      </div>
                      <FileCode2 className="w-4 h-4 text-[#40dcca] shrink-0" />
                    </button>
                  </div>
                </div>
              ) : actionGuideTab === 'lieux-nav' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onOpenNavView}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#00f2fe]">
                        Priorité haute · 1. Sélecteur dynamique Lieux &amp; Navigation
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Menu déroulant Golfe de Skikda · Méditerranée · Côte d&apos;Azur (actif : {config.region})
                      </div>
                    </div>
                    <Globe className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onOpenManualPoint}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité haute · 2. Modal Saisie Manuelle (Nom, Lat, Lon)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Ajouter point manuel avec infobulle d&apos;aide + maintien &quot;Enregistrer ma position&quot;
                      </div>
                    </div>
                    <MapPinPlus className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onExportLieuxNavJson}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 3. Configuration JSON proposée
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        lieux_navigation_config.json (lieux_navigation_ui + zones + points)
                      </div>
                    </div>
                    <FileCode2 className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>
                </div>
              ) : actionGuideTab === 'freemium' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onExportMedPoisJson}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#00f2fe]">
                        Priorité haute · 1. Générer JSON PointsInteret Méditerranée
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        {pointsInteret.length} POI Méditerranée ($GNRMC + Geofencing) → points_interet_mediterranee.json
                      </div>
                    </div>
                    <Globe className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById('has-access-manager')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 2. Icônes visuelles Premium (hasAccess)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Couronne Premium vs Gratuit sur Alertes Collision IA &amp; Historique Illimité
                      </div>
                    </div>
                    <Crown className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById('license-activation-panel')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité moyenne · 3. Licence manuelle dans visionia_memoire
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Codes d&apos;activation clé en main &amp; checkout Stripe / PayPal
                      </div>
                    </div>
                    <KeyRound className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>
                </div>
              ) : actionGuideTab === 'gps-pin' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onSaveCurrentPosition}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#00f2fe]">
                        Priorité haute · 1. Bouton &quot;Enregistrer ma position&quot;
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Capture auto via navigator.geolocation + saisie du nom du lieu uniquement
                      </div>
                    </div>
                    <MapPin className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd =
                        '/memoire --note "Enregistrement GPS 1-clic (nom + lat/lon auto via navigator.geolocation)"';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 2. Mémoriser via /memoire
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Enregistrer la décision d&apos;implémentation dans visionia_optimization.json
                      </div>
                    </div>
                    <Database className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onExtractAndSaveJson}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité haute · 3. Schéma de stockage (nom, lat, lon)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        {config.saved_places?.length || 0} lieu(x) épinglé(s) · Exporter le schéma JSON
                      </div>
                    </div>
                    <Save className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>
                </div>
              ) : actionGuideTab === 'ux' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onFocusBento}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité haute · 1. Bento grid épuré par défaut
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Métadonnées techniques masquées en mer + vitesse (kts) agrandie
                      </div>
                    </div>
                    <LayoutGrid className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onFocusCompassGps}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité haute · 2. Distances NM accentuées (AISStream)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        EL-KALA II (1.8 NM ambre) et STORA PILOT 01 (2.4 NM cyan) mis en valeur
                      </div>
                    </div>
                    <Compass className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onOpenPasserelle}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité moyenne · 3. Agent MCP migré vers Passerelle Méditerranéenne
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Barre de navigation allégée à 3 vues (Bento · Sonar · Nav)
                      </div>
                    </div>
                    <Sliders className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={onFocusCompassGps}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité moyenne · 4. Bouton plein &quot;Activer Capteurs Natifs&quot;
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Bouton principal haute visibilité pour Cap Magnétique et Position GPS
                      </div>
                    </div>
                    <LocateFixed className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>
                </div>
              ) : actionGuideTab === 'pwa' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onExportNetlifyToml}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 1. Configurer netlify.toml (racine)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Anti-cache HTTP + Permissions-Policy (geolocation, camera)
                      </div>
                    </div>
                    <FileCode2 className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/pwa_check_update --force_skip_waiting';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffb4ab]">
                        Priorité haute · 2. service-worker.js (Network-First + skipWaiting)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Auto-rafraîchissement et activation immédiate sur Android
                      </div>
                    </div>
                    <RefreshCw className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      document
                        .getElementById('pwa-deploy-panel')
                        ?.scrollIntoView({ behavior: 'smooth' });
                      onExecuteCommand('/pwa_check_update');
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 3. index.html (enregistrement SW &amp; MAJ auto)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        updateViaCache: &apos;none&apos;, manifest.json &amp; vérification 60s
                      </div>
                    </div>
                    <Smartphone className="w-4 h-4 text-[#ffba38] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cmd = '/netlify_sync --branch "main" --auto_publish';
                      setCmdInput(cmd);
                      onExecuteCommand(cmd);
                    }}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#ffba38]">
                        Priorité moyenne · 4. Connecter GitHub → Netlify CI/CD
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Synchronisation continue {config.pwa_deploy.github_repo} →{' '}
                        {config.pwa_deploy.netlify_site}
                      </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-[#40dcca] shrink-0" />
                  </button>
                </div>
              ) : actionGuideTab === 'plans' ? (
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Vérifier le verrouillage AISStream (Gratuit vs Premium)
                      </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-[#00f2fe] shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectPlan('annual')}
                    className="w-full p-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[#40dcca]">
                        Priorité moyenne · 4. Offres validées : 1 mois (20 €) · 3 mois (50 €) · 1 an (100 €)
                      </div>
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
                        Contact : {contact.phone} · {contact.email} — Cliquer pour activer l&apos;offre 1 an
                      </div>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-[#40dcca] shrink-0" />
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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
                      <div className="text-xs text-[#9eb2b8] break-words leading-relaxed">
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

            {/* Validated Contact & 1 mois / 3 mois / 1 an Pricing Summary */}
            <div className="p-3.5 rounded-lg border bg-[#19202a] border-[#40dcca]/35 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#e0fdff]">
                  Synthèse Projet &amp; Offres Validées ({contact.organization})
                </span>
                <span className="font-mono text-[11px] text-[#40dcca]">
                  20 € · 50 € · 100 €
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono text-[#dce3f0]">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#00f2fe]" />
                  <span>{contact.phone}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#40dcca]" />
                  <span className="break-all">{contact.email}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[#9eb2b8]">
                  <Globe className="w-3.5 h-3.5 text-[#ffba38]" />
                  <span>Zone : {contact.region}</span>
                </span>
              </div>
            </div>

            {/* Manual License Key & Stripe / PayPal Turnkey Activation in visionia_memoire */}
            <div
              id="license-activation-panel"
              className="p-3.5 rounded-lg bg-[#080f18] border border-[#00f2fe]/35 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#00f2fe]" />
                  <span className="text-xs font-semibold text-[#e0fdff]">
                    Licence Clé en Main &amp; <code className="text-[#40dcca]">visionia_memoire</code>
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    manualLicense.status === 'active'
                      ? 'bg-[#40dcca]/15 text-[#40dcca] border border-[#40dcca]/40'
                      : 'bg-[#232a34] text-[#9eb2b8]'
                  }`}
                >
                  {manualLicense.status === 'active'
                    ? `ACTIF (${manualLicense.provider})`
                    : 'AUCUNE LICENCE'}
                </span>
              </div>

              {manualLicense.status === 'active' ? (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#19202a] border border-[#40dcca]/40 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-[#40dcca]">
                      {manualLicense.code} · {getTierLabel(manualLicense.tier)}
                    </div>
                    <div className="text-[11px] text-[#9eb2b8]">
                      Enregistré dans visionia_memoire ({manualLicense.activatedAt})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRevokeLicense}
                    className="px-2.5 py-1 rounded bg-[#93000a]/30 text-[#ffb4ab] text-[11px] font-semibold"
                  >
                    Révoquer
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[#9eb2b8]">
                  Saisissez un code d&apos;activation manuel ou générez une licence clé en main via Stripe ou PayPal.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  aria-label="Code d'activation licence MarineVision"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  placeholder="MV-1Y-2026"
                  className="flex-1 min-w-[150px] bg-[#151c25] border border-[#3a494b] rounded-lg px-3 py-1.5 text-xs font-mono text-[#00f2fe] uppercase focus:outline-none focus:border-[#00f2fe]"
                />
                <button
                  type="button"
                  onClick={() => onActivateLicenseCode(licenseInput, 'Manuel')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold whitespace-nowrap"
                >
                  Activer code
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {TURNKEY_LICENSE_PRESETS.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => {
                      setLicenseInput(preset.code);
                      onActivateLicenseCode(preset.code, 'Manuel');
                    }}
                    className="px-2 py-1 rounded bg-[#151c25] hover:bg-[#19202a] border border-[#3a494b]/60 text-[10px] font-mono text-[#9eb2b8] hover:text-[#40dcca]"
                  >
                    {preset.code} · {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#3a494b]/40">
                <button
                  type="button"
                  onClick={() => onPurchaseTurnkey('Stripe', 'monthly')}
                  className="py-2 px-3 rounded-lg bg-[#635bff]/20 hover:bg-[#635bff]/30 border border-[#635bff]/50 text-[#e0fdff] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#a5b4fc]" />
                  <span>Licence Stripe · 1 mois (20 €)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPurchaseTurnkey('PayPal', 'annual')}
                  className="py-2 px-3 rounded-lg bg-[#0070ba]/20 hover:bg-[#0070ba]/30 border border-[#009cde]/50 text-[#e0fdff] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Licence PayPal · 1 an (100 €)</span>
                </button>
              </div>
            </div>

            {/* hasAccess Feature Entitlements Table with Visual Premium vs Free Icons */}
            <div id="has-access-manager" className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#9eb2b8]">
                  Gestionnaire de permissions (<code className="text-[#40dcca]">hasAccess</code>)
                </span>
                <span className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-[#ffba38]">
                    <Crown className="w-3 h-3" /> Premium
                  </span>
                  <span className="flex items-center gap-1 text-[#40dcca]">
                    <Sparkles className="w-3 h-3" /> Gratuit
                  </span>
                </span>
              </div>
              {(Object.keys(tools.features) as MarineFeatureKey[]).map((key) => {
                const rule = tools.features[key];
                const granted = hasAccess(key, tools);
                const isPremiumFeature = rule.required_tier === 'premium';
                return (
                  <div
                    key={key}
                    className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5 rounded-lg border text-xs ${
                      isPremiumFeature
                        ? 'bg-[#19202a] border-[#ffba38]/30'
                        : 'bg-[#19202a] border-[#3a494b]/40'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          isPremiumFeature
                            ? granted
                              ? 'bg-[#ffba38]/20 text-[#ffba38]'
                              : 'bg-[#232a34] text-[#ffba38]'
                            : 'bg-[#40dcca]/15 text-[#40dcca]'
                        }`}
                        title={isPremiumFeature ? 'Fonction Premium' : 'Fonction Gratuite'}
                      >
                        {isPremiumFeature ? (
                          <Crown className="w-3.5 h-3.5" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[#e0fdff] break-words">
                          <span>{rule.label}</span>
                          {granted ? (
                            <Unlock className="w-3 h-3 text-[#40dcca] shrink-0" />
                          ) : (
                            <Lock className="w-3 h-3 text-[#ffb4ab] shrink-0" />
                          )}
                        </div>
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
                      className={`px-2.5 py-1 rounded font-mono text-[10px] font-semibold border shrink-0 flex items-center gap-1 ${
                        isPremiumFeature
                          ? 'bg-[#ffba38]/10 border-[#ffba38]/50 text-[#ffba38]'
                          : 'bg-[#40dcca]/10 border-[#40dcca]/40 text-[#40dcca]'
                      }`}
                    >
                      {isPremiumFeature ? (
                        <Crown className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{isPremiumFeature ? 'PREMIUM' : 'GRATUIT'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Unified MarineVision Méditerranée POI Database, RAG Local & Haversine Distance */}
          <section
            id="med-poi-panel"
            className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#00f2fe]" />
                <h3 className="text-base font-semibold text-[#e0fdff]">
                  MarineVision Méditerranée · Base Unifiée (<code className="text-[#40dcca]">PointsInteret</code>)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenImplScriptModal('javascript')}
                  className="px-2 py-1 rounded bg-[#080f18] border border-[#3a494b] text-[11px] font-mono text-[#ffba38] hover:border-[#ffba38]"
                >
                  Script JS
                </button>
                <button
                  type="button"
                  onClick={() => onOpenImplScriptModal('python')}
                  className="px-2 py-1 rounded bg-[#080f18] border border-[#3a494b] text-[11px] font-mono text-[#40dcca] hover:border-[#40dcca]"
                >
                  Script Python
                </button>
                <button
                  type="button"
                  onClick={onExportMedPoisJson}
                  className="text-xs font-mono text-[#00f2fe] hover:underline"
                >
                  JSON
                </button>
              </div>
            </div>

            {/* Dynamic GPS Reference + NMEA Capture */}
            <div className="p-3 rounded-lg bg-[#080f18] border border-[#3a494b]/50 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[#40dcca]">
                    Calculateur Haversine &amp; Capture $GNRMC
                  </div>
                  <div className="text-[11px] font-mono text-[#9eb2b8] break-all">
                    {telemetry.nmeaSentence}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCapturePoiFromGnrmc}
                  className="px-3 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold whitespace-nowrap shrink-0"
                >
                  + POI depuis $GNRMC
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3a494b]/40">
                <span className="text-[11px] text-[#9eb2b8]">Position GPS origine :</span>
                <input
                  type="text"
                  aria-label="Latitude origine calcul distance"
                  value={refLatInput}
                  onChange={(e) => setRefLatInput(e.target.value)}
                  className="w-24 bg-[#151c25] border border-[#3a494b] rounded px-2 py-1 text-[11px] font-mono text-[#00f2fe]"
                />
                <input
                  type="text"
                  aria-label="Longitude origine calcul distance"
                  value={refLonInput}
                  onChange={(e) => setRefLonInput(e.target.value)}
                  className="w-24 bg-[#151c25] border border-[#3a494b] rounded px-2 py-1 text-[11px] font-mono text-[#00f2fe]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setRefLatInput(VESSEL_LAT.toFixed(4));
                    setRefLonInput(VESSEL_LON.toFixed(4));
                  }}
                  className="px-2 py-1 rounded bg-[#19202a] border border-[#3a494b]/60 text-[10px] font-mono text-[#40dcca]"
                >
                  Skikda
                </button>
              </div>
            </div>

            {/* Local RAG Index Search & Trigger */}
            <div className="p-3 rounded-lg bg-[#19202a] border border-[#00f2fe]/30 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e0fdff]">
                  <Database className="w-3.5 h-3.5 text-[#00f2fe]" />
                  <span>RAG Local Méditerranée ({ragIndex.total_docs} docs indexés)</span>
                </div>
                <button
                  type="button"
                  onClick={onIndexRagDatabase}
                  className="px-2.5 py-1 rounded bg-[#00f2fe]/15 hover:bg-[#00f2fe]/25 border border-[#00f2fe]/40 text-[11px] font-mono text-[#00f2fe]"
                >
                  Indexer RAG local
                </button>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9eb2b8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="Rechercher dans le RAG (ex: Corse, Kornati, Alboran, Skikda, mouillage)..."
                  className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#e0fdff] placeholder-[#849495] focus:outline-none focus:border-[#00f2fe]"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[30rem] overflow-y-auto">
              {(() => {
                const originLat = parseFloat(refLatInput.replace(',', '.'));
                const originLon = parseFloat(refLonInput.replace(',', '.'));
                const safeLat = Number.isNaN(originLat) ? VESSEL_LAT : originLat;
                const safeLon = Number.isNaN(originLon) ? VESSEL_LON : originLon;
                const matchedIds = ragQuery.trim()
                  ? new Set(queryLocalRagIndex(ragIndex, ragQuery).map((e) => e.doc_id))
                  : null;

                return pointsInteret
                  .filter((poi) => !matchedIds || matchedIds.has(poi.id))
                  .map((poi) => {
                    const vec = calculateGpsDistance(safeLat, safeLon, poi.lat, poi.lon);
                    return { poi, vec };
                  })
                  .sort((a, b) => a.vec.distanceNm - b.vec.distanceNm)
                  .map(({ poi, vec }) => {
                    const aiAllowed = hasAccess('collision_ai_alerts', tools);
                    return (
                      <div
                        key={poi.id}
                        className="p-2.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-[#e0fdff]">
                            <MapPin className="w-3.5 h-3.5 text-[#00f2fe] shrink-0" />
                            <span>{poi.nom}</span>
                            {poi.pays && (
                              <span className="text-[10px] font-mono text-[#40dcca] shrink-0">
                                ({poi.pays})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-[#9eb2b8] break-words">
                            {poi.bassin || poi.secteur} · {poi.lat.toFixed(3)}°, {poi.lon.toFixed(3)}°
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right font-mono tabular-nums">
                            <div className="text-xs font-bold text-[#00f2fe]">
                              {vec.distanceNm.toFixed(1)} NM
                            </div>
                            <div className="text-[10px] text-[#9eb2b8]">
                              {vec.distanceKm.toFixed(0)} km · {vec.bearingDeg}° {vec.cardinal}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onTogglePoiAiAlert(poi.id)}
                            className={`px-2 py-1 rounded text-[10px] font-mono border shrink-0 flex items-center gap-1 ${
                              poi.alerte_collision_ia && aiAllowed
                                ? 'bg-[#ffba38]/15 border-[#ffba38]/50 text-[#ffba38]'
                                : 'bg-[#080f18] border-[#3a494b] text-[#9eb2b8]'
                            }`}
                          >
                            {!aiAllowed && <Lock className="w-2.5 h-2.5 text-[#ffba38]" />}
                            <span>{poi.alerte_collision_ia ? 'IA ON' : 'IA OFF'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  });
              })()}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
              <div className="flex flex-wrap items-center justify-between gap-2">
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex-1 min-w-[200px] bg-[#080f18] border border-[#3a494b]/50 rounded px-2.5 py-1.5 font-mono text-[10px] text-[#40dcca] break-all">
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
                  <div className="text-xs font-medium text-[#e0fdff] flex items-center gap-1.5">
                    <span>
                      Enregistrement trajets : <code className="text-[#00f2fe]">visionia_memoire</code>
                    </span>
                    {hasAccess('unlimited_history', tools) ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#ffba38]/15 text-[#ffba38] text-[10px] font-mono flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" /> Illimité
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-[#232a34] text-[#9eb2b8] text-[10px] font-mono">
                        Gratuit (max 5 pts)
                      </span>
                    )}
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

        {/* Right: PWA Deploy Panel, visionia_optimization.json & Streaming Event Log */}
        <div className="lg:col-span-6 space-y-5">
          <PwaDeployPanel
            pwaDeploy={config.pwa_deploy}
            onUpdatePwaDeploy={onUpdatePwaDeploy}
            onSyncNetlify={onSyncNetlify}
            onExportNetlifyToml={onExportNetlifyToml}
            onNotify={onNotify}
            onLog={onLog}
          />

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
