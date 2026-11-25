import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Copy, Download, MapPin, QrCode, Share2, Shield, UserCheck } from 'lucide-react';
import { AgentMcpView } from './components/AgentMcpView';
import { BentoDashboard } from './components/BentoDashboard';
import { Header } from './components/Header';
import { Modal } from './components/Modal';
import { OfflineIndicator } from './components/PWAInstallButton';
import { buildDistributionUrl, QrShareBody } from './components/QrShareModal';
import { ActiveScanArea, SonarMapView } from './components/SonarMapView';
import { WaypointsNavView } from './components/WaypointsNavView';
import {
  ImportHistoryEntry,
  LocalRagIndex,
  ManualLicenseRecord,
  MarineFeatureKey,
  McpConfig,
  McpLogEntry,
  MemoireDecision,
  NavigationZoneId,
  NmeaBaudRate,
  PointInteretMed,
  PwaDeployConfig,
  SavedPlaceRecord,
  SubscriptionTier,
  TabId,
  TelemetryState,
  TrackPoint,
  Waypoint,
  WaypointCategory,
} from './types/marine';
import {
  DEFAULT_MARINE_TOOLS_CONFIG,
  EMPTY_MANUAL_LICENSE,
  getTierLabel,
  hasAccess,
  normalizeSubscriptionTier,
  PROJECT_CONTACT,
  validateLicenseCode,
} from './utils/accessControl';
import {
  downloadImplScript,
  downloadSampleSkikdaCsv,
  downloadSyncScript,
  exportLieuxNavigationConfigJson,
  exportMarineToolsConfigJson,
  exportMedPointsInteretJson,
  exportNetlifyToml,
  exportOptimizationJson,
  exportSetupMarineGpsJson,
  exportWaypointsXlsx,
} from './utils/exporters';
import {
  buildAutoSyncScript,
  buildLocalRagIndex,
  buildNmeaSentence,
  buildSelectionMenuScript,
  buildWaypointFromCsvRow,
  createInitialTrackMemoire,
  createInitialWaypoints,
  DEFAULT_MCP_CONFIG,
  DEFAULT_MED_POINTS_INTERET,
  getNavigationZone,
  MANUAL_POINT_TOOLTIP,
  NAVIGATION_ZONES,
  parseGnrmcCoords,
  parseGpxText,
  parseSkikdaCsvText,
  SAMPLE_SKIKDA_CSV,
  VESSEL_LAT,
  VESSEL_LON,
} from './utils/navigation';

const STORAGE_KEY = 'marinevision_skikda_v2';
const TRACK_MEMOIRE_KEY = 'visionia_memoire';
const LICENSE_MEMOIRE_KEY = 'visionia_memoire_license';
const RAG_MEMOIRE_KEY = 'visionia_memoire_rag';
const IS_ADMIN_STORAGE_KEY = 'marina_visionnaire_is_admin';

function resolveInitialIsAdmin(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode')?.toLowerCase();
    const adminParam = params.get('admin');
    const guestParam = params.get('guest');
    if (mode === 'guest' || mode === 'invite' || guestParam === '1' || adminParam === '0') {
      return false;
    }
    if (adminParam === '1' || mode === 'admin') {
      return true;
    }
  }
  try {
    const saved = localStorage.getItem(IS_ADMIN_STORAGE_KEY);
    if (saved === 'false') return false;
    if (saved === 'true') return true;
  } catch {
    // ignore
  }
  return true;
}

interface SavedPersistedState {
  config: McpConfig;
  waypoints: Waypoint[];
  pointsInteret?: PointInteretMed[];
  savedPlaces?: SavedPlaceRecord[];
  memoireDecisions?: MemoireDecision[];
  activeWaypointId: string;
  cacheSizeMb: number;
  importHistory: ImportHistoryEntry[];
}

function hydrateConfig(raw?: Partial<McpConfig> | null): McpConfig {
  const rawPlans = raw?.marine_tools_config?.plans;
  const hasValidatedPlans =
    Array.isArray(rawPlans) &&
    rawPlans.some((p) => p.id === 'monthly' || p.id === 'quarterly' || p.id === 'annual');

  return {
    ...DEFAULT_MCP_CONFIG,
    ...(raw || {}),
    project_contact: {
      ...PROJECT_CONTACT,
      ...(raw?.project_contact || {}),
    },
    pwa_deploy: {
      ...DEFAULT_MCP_CONFIG.pwa_deploy,
      ...(raw?.pwa_deploy || {}),
    },
    marine_tools_config: {
      ...DEFAULT_MARINE_TOOLS_CONFIG,
      ...(raw?.marine_tools_config || {}),
      active_plan: normalizeSubscriptionTier(raw?.marine_tools_config?.active_plan),
      plans: hasValidatedPlans ? rawPlans! : DEFAULT_MARINE_TOOLS_CONFIG.plans,
      features: {
        ...DEFAULT_MARINE_TOOLS_CONFIG.features,
        ...(raw?.marine_tools_config?.features || {}),
      },
      sensors_api: {
        ...DEFAULT_MARINE_TOOLS_CONFIG.sensors_api,
        ...(raw?.marine_tools_config?.sensors_api || {}),
      },
    },
    MARINE_GPS_TRACKER: {
      ...DEFAULT_MCP_CONFIG.MARINE_GPS_TRACKER,
      ...(raw?.MARINE_GPS_TRACKER || {}),
    },
    mcp_agent: {
      ...DEFAULT_MCP_CONFIG.mcp_agent,
      ...(raw?.mcp_agent || {}),
    },
    geofence: {
      ...DEFAULT_MCP_CONFIG.geofence,
      ...(raw?.geofence || {}),
    },
    gnss_nmea: {
      ...DEFAULT_MCP_CONFIG.gnss_nmea,
      ...(raw?.gnss_nmea || {}),
      constellations: {
        ...DEFAULT_MCP_CONFIG.gnss_nmea.constellations,
        ...(raw?.gnss_nmea?.constellations || {}),
      },
    },
    points_navigation: raw?.points_navigation || DEFAULT_MCP_CONFIG.points_navigation,
    points_interet: raw?.points_interet?.length
      ? raw.points_interet
      : DEFAULT_MED_POINTS_INTERET,
    saved_places: raw?.saved_places || [],
    memoire_decisions: raw?.memoire_decisions || [],
    active_zone_id: raw?.active_zone_id || DEFAULT_MCP_CONFIG.active_zone_id,
    lieux_navigation_ui: {
      ...DEFAULT_MCP_CONFIG.lieux_navigation_ui!,
      ...(raw?.lieux_navigation_ui || {}),
      selected_zone:
        raw?.active_zone_id ||
        raw?.lieux_navigation_ui?.selected_zone ||
        DEFAULT_MCP_CONFIG.active_zone_id!,
    },
  };
}

function loadSavedState(): SavedPersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedPersistedState) : null;
  } catch {
    return null;
  }
}

function loadTrackMemoire(): TrackPoint[] {
  try {
    const raw = localStorage.getItem(TRACK_MEMOIRE_KEY);
    if (!raw) return createInitialTrackMemoire();
    const parsed = JSON.parse(raw) as TrackPoint[];
    return Array.isArray(parsed) ? parsed : createInitialTrackMemoire();
  } catch {
    return createInitialTrackMemoire();
  }
}

function loadLicenseMemoire(): ManualLicenseRecord {
  try {
    const raw = localStorage.getItem(LICENSE_MEMOIRE_KEY);
    if (!raw) return EMPTY_MANUAL_LICENSE;
    const parsed = JSON.parse(raw) as ManualLicenseRecord;
    return parsed && parsed.status === 'active' ? parsed : EMPTY_MANUAL_LICENSE;
  } catch {
    return EMPTY_MANUAL_LICENSE;
  }
}

function loadRagIndex(): LocalRagIndex {
  try {
    const raw = localStorage.getItem(RAG_MEMOIRE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalRagIndex;
      if (parsed && Array.isArray(parsed.entries) && parsed.entries.length >= 8) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return buildLocalRagIndex(DEFAULT_MED_POINTS_INTERET, NAVIGATION_ZONES);
}

function mergeUnifiedMedPois(saved?: PointInteretMed[] | null): PointInteretMed[] {
  if (!saved?.length) return DEFAULT_MED_POINTS_INTERET;
  const byId = new Map<string, PointInteretMed>();
  DEFAULT_MED_POINTS_INTERET.forEach((p) => byId.set(p.id, p));
  saved.forEach((p) => {
    const base = byId.get(p.id);
    byId.set(p.id, base ? { ...base, ...p, bassin: p.bassin || base.bassin, pays: p.pays || base.pays } : p);
  });
  return Array.from(byId.values());
}

type ActiveModal =
  | { type: 'none' }
  | { type: 'save-place';
      lat: number;
      lon: number;
      accuracyM: number;
      source: 'navigator.geolocation' | 'gnss_fallback';
    }
  | { type: 'manual-point' }
  | { type: 'impl-script'; lang: 'javascript' | 'python' }
  | { type: 'edit'; wp: Waypoint }
  | { type: 'details'; wp: Waypoint }
  | { type: 'history' }
  | { type: 'pdf' }
  | { type: 'profile' }
  | { type: 'sync-script' }
  | { type: 'qr-share'; guestMode: boolean };

export default function App() {
  const initialSaved = useMemo(() => loadSavedState(), []);

  const [IS_ADMIN, setIsAdmin] = useState<boolean>(() => resolveInitialIsAdmin());
  const [activeTab, setActiveTab] = useState<TabId>('dashboard-bento');
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() =>
    initialSaved?.waypoints?.length ? initialSaved.waypoints : createInitialWaypoints()
  );
  const [pointsInteret, setPointsInteret] = useState<PointInteretMed[]>(() =>
    mergeUnifiedMedPois(initialSaved?.pointsInteret)
  );
  const [ragIndex, setRagIndex] = useState<LocalRagIndex>(() => loadRagIndex());
  const [manualLicense, setManualLicense] = useState<ManualLicenseRecord>(() =>
    loadLicenseMemoire()
  );
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceRecord[]>(
    () => initialSaved?.savedPlaces || []
  );
  const [memoireDecisions, setMemoireDecisions] = useState<MemoireDecision[]>(
    () =>
      initialSaved?.memoireDecisions || [
        {
          id: 'MEM-01',
          note: 'Capture GPS 1-clic via navigator.geolocation (sans saisie manuelle lat/lon)',
          timestamp: 'Initialisation',
        },
      ]
  );
  const [trackMemoire, setTrackMemoire] = useState<TrackPoint[]>(() => loadTrackMemoire());
  const [activeWaypointId, setActiveWaypointId] = useState<string>(
    () => initialSaved?.activeWaypointId || 'WP-01'
  );
  const [config, setConfig] = useState<McpConfig>(() => hydrateConfig(initialSaved?.config));
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const [cacheSizeMb, setCacheSizeMb] = useState<number>(
    () => (typeof initialSaved?.cacheSizeMb === 'number' ? initialSaved.cacheSizeMb : 142)
  );
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(
    () =>
      initialSaved?.importHistory || [
        { date: 'Initialisation', file: 'skikda_points.csv', count: 6 },
      ]
  );
  const [headingApplied, setHeadingApplied] = useState(false);
  const [fishVisible, setFishVisible] = useState(true);
  const [isCapturingPosition, setIsCapturingPosition] = useState(false);
  const [activeScanArea, setActiveScanArea] = useState<ActiveScanArea | null>(null);
  const [autoLogCountdownSec, setAutoLogCountdownSec] = useState<number>(
    () => config.MARINE_GPS_TRACKER.auto_log_interval_sec
  );

  const [telemetry, setTelemetry] = useState<TelemetryState>(() => ({
    sog: 11.8,
    cog: 68,
    depth: 38.6,
    chirpDepth: 42.5,
    battery: 94,
    gpuLoad: config.mcp_agent.ai_transit_sleep ? 9 : 42,
    gpuTemp: config.mcp_agent.ai_transit_sleep ? 43 : 58,
    memoryBufferMb: 284,
    latency: 82,
    bentoLatency: 14,
    fps: config.mcp_agent.ai_transit_sleep ? 0 : config.mcp_agent.low_power_mode ? 5 : 18,
    gnssSynced: false,
    gnssOffsetM: 14.2,
    gnssAnchor: 'Non calibré (dérive Skikda)',
    satellites: {
      gps: 9,
      glonass: 6,
      galileo: 5,
      hdop: 0.8,
      fixType: '3D DGPS',
    },
    nmeaSentence: buildNmeaSentence(VESSEL_LAT, VESSEL_LON, 11.8, 68, config.gnss_nmea.baudrate),
  }));

  const [logs, setLogs] = useState<McpLogEntry[]>([
    {
      id: 'log-1',
      time: '09:42:15',
      tag: 'ENTITLEMENT',
      source: 'marine_tools_config.json',
      detail: `Plan actif : ${getTierLabel(config.marine_tools_config.active_plan)} · hasAccess('ais_stream') = ${String(hasAccess('ais_stream', config.marine_tools_config))}`,
    },
    {
      id: 'log-2',
      time: '09:40:02',
      tag: 'SYNC',
      source: 'Config Engine',
      detail: 'marine_tools_config.json intégré dans visionia_optimization.json',
    },
  ]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal>({ type: 'none' });

  // Edit, Save-Place & Manual Point form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<WaypointCategory>('fish');
  const [editDepth, setEditDepth] = useState('28');
  const [placeNameInput, setPlaceNameInput] = useState('');
  const [placeCategoryInput, setPlaceCategoryInput] = useState<WaypointCategory>('anchor');
  const [manualName, setManualName] = useState('');
  const [manualLat, setManualLat] = useState('36.9350');
  const [manualLon, setManualLon] = useState('6.9550');
  const [manualDepth, setManualDepth] = useState('24');
  const [manualCategory, setManualCategory] = useState<WaypointCategory>('anchor');
  const [manualZoneId, setManualZoneId] = useState<NavigationZoneId>('skikda');
  const [manualError, setManualError] = useState<string | null>(null);

  const activeZone = useMemo(
    () => getNavigationZone(config.active_zone_id),
    [config.active_zone_id]
  );

  const syncedConfig = useMemo<McpConfig>(
    () => ({
      ...config,
      app_brand: 'MarineVision Méditerranée',
      region: activeZone.label,
      active_zone_id: activeZone.id,
      lieux_navigation_ui: {
        ...(config.lieux_navigation_ui || DEFAULT_MCP_CONFIG.lieux_navigation_ui!),
        selected_zone: activeZone.id,
      },
      rag_index: ragIndex,
      points_navigation: waypoints.map((w) => ({
        id: w.id,
        name: w.name,
        lat: w.lat,
        long: w.lon,
        depth: w.depthM,
        type: w.rawType || w.category,
      })),
      points_interet: pointsInteret,
      saved_places: savedPlaces,
      memoire_decisions: memoireDecisions,
    }),
    [config, activeZone, ragIndex, waypoints, pointsInteret, savedPlaces, memoireDecisions]
  );

  // Persist app state and visionia_memoire to localStorage
  useEffect(() => {
    try {
      const payload: SavedPersistedState = {
        config: syncedConfig,
        waypoints,
        pointsInteret,
        savedPlaces,
        memoireDecisions,
        activeWaypointId,
        cacheSizeMb,
        importHistory,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    syncedConfig,
    waypoints,
    pointsInteret,
    savedPlaces,
    memoireDecisions,
    activeWaypointId,
    cacheSizeMb,
    importHistory,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(TRACK_MEMOIRE_KEY, JSON.stringify(trackMemoire));
    } catch {
      // Ignore storage quota errors
    }
  }, [trackMemoire]);

  useEffect(() => {
    try {
      localStorage.setItem(LICENSE_MEMOIRE_KEY, JSON.stringify(manualLicense));
    } catch {
      // Ignore storage quota errors
    }
  }, [manualLicense]);

  // Live telemetry & NMEA sentence loop
  useEffect(() => {
    const id = window.setInterval(() => {
      const sleeping = config.mcp_agent.ai_transit_sleep;
      const lowPower = config.mcp_agent.low_power_mode;
      const gnss = config.gnss_nmea;
      const clearSky = gnss.antenna_clear_sky;
      const permissionOk = gnss.android_permission !== 'denied';

      const nextSog = +(11.6 + Math.sin(Date.now() / 4000) * 0.4).toFixed(1);
      const nextDepth = +(38.4 + Math.cos(Date.now() / 5000) * 0.5).toFixed(1);
      const nextChirp = +(42.3 + Math.sin(Date.now() / 3500) * 0.4).toFixed(1);

      const gpsCount = permissionOk && gnss.constellations.gps ? (clearSky ? 9 : 3) : 0;
      const gloCount = permissionOk && gnss.constellations.glonass ? (clearSky ? 6 : 2) : 0;
      const galCount = permissionOk && gnss.constellations.galileo ? (clearSky ? 5 : 1) : 0;
      const totalSats = gpsCount + gloCount + galCount;
      const hdop = !permissionOk ? 9.9 : !clearSky ? 3.4 : totalSats >= 14 ? 0.7 : 1.3;
      const fixType = !permissionOk ? 'NO FIX' : !clearSky ? '2D Dégradé' : '3D DGPS';

      setTelemetry((prev) => ({
        ...prev,
        sog: nextSog,
        depth: nextDepth,
        chirpDepth: nextChirp,
        gpuLoad: sleeping
          ? 8 + Math.floor(Math.random() * 4)
          : lowPower
            ? 18 + Math.floor(Math.random() * 5)
            : 40 + Math.floor(Math.random() * 7),
        gpuTemp: sleeping ? 42 : lowPower ? 51 : 58,
        bentoLatency: 12 + Math.floor(Math.random() * 5),
        fps: sleeping ? 0 : lowPower ? 5 : 18,
        satellites: {
          gps: gpsCount,
          glonass: gloCount,
          galileo: galCount,
          hdop,
          fixType,
        },
        nmeaSentence: gnss.nmea_connected
          ? buildNmeaSentence(VESSEL_LAT, VESSEL_LON, nextSog, prev.cog, gnss.baudrate)
          : 'NMEA: Port fermé',
      }));
    }, 2500);
    return () => window.clearInterval(id);
  }, [config.mcp_agent.low_power_mode, config.mcp_agent.ai_transit_sleep, config.gnss_nmea]);

  // Periodic recording of tracks into local visionia_memoire when active
  useEffect(() => {
    if (!config.gnss_nmea.record_to_memoire || config.gnss_nmea.android_permission === 'denied') {
      return;
    }
    const id = window.setInterval(() => {
      setTrackMemoire((prev) => {
        const nextIdx = prev.length + 1;
        const driftLat = +(VESSEL_LAT + Math.sin(nextIdx * 0.45) * 0.008).toFixed(4);
        const driftLon = +(VESSEL_LON + Math.cos(nextIdx * 0.45) * 0.01).toFixed(4);
        const pt: TrackPoint = {
          id: `TRK-${String(nextIdx).padStart(2, '0')}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          lat: driftLat,
          lon: driftLon,
          sog: telemetry.sog,
          cog: telemetry.cog,
          depth: telemetry.depth,
          protocol: `${config.gnss_nmea.protocol_mode} (${config.gnss_nmea.baudrate} baud)`,
        };
        const maxPts = hasAccess('unlimited_history', config.marine_tools_config) ? 120 : 5;
        return [...prev.slice(-(maxPts - 1)), pt];
      });
    }, 10000);
    return () => window.clearInterval(id);
  }, [
    config.gnss_nmea.record_to_memoire,
    config.gnss_nmea.android_permission,
    config.gnss_nmea.protocol_mode,
    config.gnss_nmea.baudrate,
    config.marine_tools_config,
    telemetry.sog,
    telemetry.cog,
    telemetry.depth,
  ]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const appendLog = useCallback((tag: string, source: string, detail: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      { id: `${Date.now()}-${Math.random()}`, time, tag, source, detail },
      ...prev.slice(0, 34),
    ]);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(IS_ADMIN_STORAGE_KEY, String(IS_ADMIN));
    } catch {
      // ignore
    }
    if (!IS_ADMIN && activeTab === 'agent-mcp-config') {
      setActiveTab('dashboard-bento');
    }
  }, [IS_ADMIN, activeTab]);

  const handleToggleAdminMode = useCallback(
    (nextAdmin: boolean) => {
      setIsAdmin(nextAdmin);
      if (!nextAdmin && activeTab === 'agent-mcp-config') {
        setActiveTab('dashboard-bento');
      }
      appendLog(
        'ARCHITECTURE',
        'IS_ADMIN',
        nextAdmin
          ? 'IS_ADMIN = true (Cockpit Admin & Agent MCP activés)'
          : 'IS_ADMIN = false (Mode Invité activé — interface client épurée)'
      );
      showToast(
        nextAdmin
          ? 'Mode Admin activé (accès complet Passerelle & MCP)'
          : 'Mode Invité activé (interface client épurée)'
      );
    },
    [activeTab, appendLog, showToast]
  );

  const partagerApp = useCallback(
    async (guestMode = true) => {
      const shareUrl = buildDistributionUrl(guestMode);
      const shareData = {
        title: 'Marina Visionnaire — Méditerranée',
        text: 'Découvrez Marina Visionnaire : navigation marine, sondeur CHIRP et carte Méditerranée en Mode Invité.',
        url: shareUrl,
      };
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share(shareData);
          appendLog('PARTAGE', 'navigator.share', `partagerApp() exécuté (${shareUrl})`);
          showToast('Marina Visionnaire partagée avec succès');
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
        }
      }
      try {
        await navigator.clipboard?.writeText(shareUrl);
        appendLog('PARTAGE', 'clipboard', `Lien copié via partagerApp() : ${shareUrl}`);
        showToast('Lien de partage copié dans le presse-papier');
      } catch {
        setModal({ type: 'qr-share', guestMode });
      }
    },
    [appendLog, showToast]
  );

  const handleOpenQrShare = useCallback(
    (guestMode = true) => {
      setModal({ type: 'qr-share', guestMode });
      appendLog('QR CODE', 'Distribution PWA', `QR Code généré (mode=${guestMode ? 'guest' : 'standard'})`);
    },
    [appendLog]
  );

  const handleDownloadManifest = useCallback(() => {
    const manifestPayload = {
      id: '/',
      name: 'Marina Visionnaire — Méditerranée',
      short_name: 'MarinaVision',
      description:
        'Application PWA de navigation maritime en Méditerranée : carte tactique, sondeur CHIRP, capture GPS et partage en Mode Invité.',
      start_url: '/?mode=guest',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      lang: 'fr',
      theme_color: '#0d141d',
      background_color: '#0d141d',
      categories: ['navigation', 'utilities'],
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };
    const blob = new Blob([JSON.stringify(manifestPayload, null, 2)], {
      type: 'application/manifest+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    appendLog('PWA', 'manifest.json', 'manifest.json Marina Visionnaire téléchargé');
    showToast('manifest.json (Marina Visionnaire) téléchargé');
  }, [appendLog, showToast]);

  // 60s Auto-Log Excel Countdown Timer (/set_auto_log)
  useEffect(() => {
    if (!config.MARINE_GPS_TRACKER.auto_log_excel) {
      setAutoLogCountdownSec(config.MARINE_GPS_TRACKER.auto_log_interval_sec);
      return;
    }

    const timer = window.setInterval(() => {
      setAutoLogCountdownSec((prev) => {
        if (prev <= 1) {
          appendLog(
            'AUTO-LOG XLSX',
            config.MARINE_GPS_TRACKER.target_file,
            `Cycle ${config.MARINE_GPS_TRACKER.auto_log_interval_sec}s exécuté (${trackMemoire.length} pts visionia_memoire consolidés)`
          );
          return config.MARINE_GPS_TRACKER.auto_log_interval_sec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    config.MARINE_GPS_TRACKER.auto_log_excel,
    config.MARINE_GPS_TRACKER.auto_log_interval_sec,
    config.MARINE_GPS_TRACKER.target_file,
    trackMemoire.length,
    appendLog,
  ]);

  const handleSelectPlan = useCallback(
    (tier: SubscriptionTier) => {
      setConfig((prev) => ({
        ...prev,
        marine_tools_config: {
          ...prev.marine_tools_config,
          active_plan: tier,
        },
      }));
      setIsConfigDirty(true);
      const aisUnlocked =
        config.marine_tools_config.features.ais_stream.enabled &&
        (config.marine_tools_config.features.ais_stream.required_tier === 'free' || tier !== 'free');
      appendLog(
        'PLAN',
        'marine_tools_config',
        `Plan activé : ${getTierLabel(tier)} · AISStream ${aisUnlocked ? 'DÉVERROUILLÉ' : 'VERROUILLÉ'}`
      );
      showToast(
        `${getTierLabel(tier)} activé${aisUnlocked ? ' — AISStream débloqué' : ' — AISStream verrouillé'}`
      );
    },
    [config.marine_tools_config.features.ais_stream, appendLog, showToast]
  );

  const handleReviseWeeklyPrice = useCallback(
    (priceEur: number) => {
      const clean = Math.max(0.99, +priceEur.toFixed(2));
      setConfig((prev) => ({
        ...prev,
        marine_tools_config: {
          ...prev.marine_tools_config,
          pricing_revised: clean < 12.99,
          plans: prev.marine_tools_config.plans.map((p) =>
            p.id === 'weekly' ? { ...p, price_eur: clean } : p
          ),
        },
      }));
      setIsConfigDirty(true);
      appendLog(
        'PRICING',
        'Tarif Weekly',
        `Tarif Weekly révisé à ${clean.toFixed(2)} EUR (vs Yearly 12.99 EUR)`
      );
      showToast(`Tarif Weekly mis à jour : ${clean.toFixed(2)} EUR`);
    },
    [appendLog, showToast]
  );

  const handleToggleFeatureTier = useCallback(
    (feature: MarineFeatureKey) => {
      const current = config.marine_tools_config.features[feature];
      const nextTier: 'free' | 'premium' =
        current.required_tier === 'premium' ? 'free' : 'premium';
      setConfig((prev) => ({
        ...prev,
        marine_tools_config: {
          ...prev.marine_tools_config,
          features: {
            ...prev.marine_tools_config.features,
            [feature]: {
              ...prev.marine_tools_config.features[feature],
              required_tier: nextTier,
            },
          },
        },
      }));
      setIsConfigDirty(true);
      appendLog('ACL', `hasAccess('${feature}')`, `Niveau requis basculé sur ${nextTier.toUpperCase()}`);
    },
    [config.marine_tools_config.features, appendLog]
  );

  const handleTestHasAccess = useCallback(
    (feature: MarineFeatureKey) => {
      const allowed = hasAccess(feature, config.marine_tools_config);
      appendLog(
        'HAS_ACCESS',
        `hasAccess('${feature}')`,
        `Plan=${config.marine_tools_config.active_plan} -> ${allowed ? 'AUTORISÉ (true)' : 'VERROUILLÉ (false)'}`
      );
      showToast(
        `hasAccess('${feature}') = ${String(allowed)} (${getTierLabel(config.marine_tools_config.active_plan)})`
      );
    },
    [config.marine_tools_config, appendLog, showToast]
  );

  const handleEnableSystemHook = useCallback(
    (sensorId = 'GNSS_L5', enable = true) => {
      setConfig((prev) => ({
        ...prev,
        MARINE_GPS_TRACKER: {
          ...prev.MARINE_GPS_TRACKER,
          sensor_id: sensorId,
          hardware_hook_active: enable,
        },
      }));
      setIsConfigDirty(true);
      appendLog(
        'SYSTEM HOOK',
        '/system_hook',
        `Capteur matériel "${sensorId}" ${enable ? 'activé (flux 1Hz prêt)' : 'désactivé'}`
      );
      showToast(
        enable ? `Capteur ${sensorId} activé (flux 1Hz)` : `Capteur ${sensorId} désactivé`
      );
    },
    [appendLog, showToast]
  );

  const handleSetAutoLog = useCallback(
    (intervalSec = 60, targetFile = 'donnees_visionia.xlsx') => {
      setConfig((prev) => ({
        ...prev,
        MARINE_GPS_TRACKER: {
          ...prev.MARINE_GPS_TRACKER,
          auto_log_excel: true,
          auto_log_interval_sec: intervalSec,
          target_file: targetFile,
        },
      }));
      setAutoLogCountdownSec(intervalSec);
      setIsConfigDirty(true);
      appendLog(
        'AUTO-LOG',
        '/set_auto_log',
        `Auto-log Excel activé : intervalle ${intervalSec}s -> ${targetFile}`
      );
      showToast(`Auto-log activé (${intervalSec}s → ${targetFile})`);
    },
    [appendLog, showToast]
  );

  const handleExportSetupMarineGpsJson = useCallback(() => {
    exportSetupMarineGpsJson(syncedConfig, telemetry.chirpDepth);
    appendLog(
      'EXPORT',
      'setup_marine_gps.json',
      `Fichier setup_marine_gps.json généré (GNSS_L5 + bathymétrie ${telemetry.chirpDepth.toFixed(1)}m)`
    );
    showToast('setup_marine_gps.json téléchargé');
  }, [syncedConfig, telemetry.chirpDepth, appendLog, showToast]);

  const handleExportMarineToolsJson = useCallback(() => {
    exportMarineToolsConfigJson(syncedConfig.marine_tools_config);
    appendLog(
      'EXPORT',
      'marine_tools_config.json',
      `Configuration plans & hasAccess exportée (${getTierLabel(syncedConfig.marine_tools_config.active_plan)})`
    );
    showToast('marine_tools_config.json téléchargé');
  }, [syncedConfig.marine_tools_config, appendLog, showToast]);

  const handleGnssSync = useCallback(() => {
    setTelemetry((prev) => ({
      ...prev,
      gnssSynced: true,
      gnssOffsetM: 0.4,
      gnssAnchor: 'Stora (36.9045°N, 6.8860°E)',
    }));
    appendLog(
      'GNSS SYNC',
      '/gnss_sync',
      'Localisation calibrée sur Stora · dérive ramenée à ±0.4 m'
    );
    showToast('GNSS calibré sur Stora (±0.4 m)');
  }, [appendLog, showToast]);

  const handleGnssReset = useCallback(
    (forceOn: boolean, intervalMs: number) => {
      setConfig((prev) => ({
        ...prev,
        gnss_nmea: {
          ...prev.gnss_nmea,
          update_interval_ms: intervalMs,
          constellations: forceOn
            ? { gps: true, glonass: true, galileo: true }
            : prev.gnss_nmea.constellations,
        },
      }));
      setTelemetry((prev) => ({
        ...prev,
        gnssSynced: true,
        gnssOffsetM: 0.4,
        gnssAnchor: 'Stora (Reset GNSS Multi-Constellation)',
        satellites: {
          gps: 10,
          glonass: 7,
          galileo: 6,
          hdop: 0.7,
          fixType: '3D DGPS',
        },
      }));
      setIsConfigDirty(true);
      appendLog(
        'GNSS RESET',
        '/gnss_reset',
        `force_on=${String(forceOn)} · interval=${intervalMs}ms -> 23 sats verrouillés (GPS/GLONASS/Galileo)`
      );
      showToast(`Capteur GNSS réinitialisé (${intervalMs} ms · GPS/GLONASS/Galileo)`);
    },
    [appendLog, showToast]
  );

  const handleConnectNmea = useCallback(
    (port: string, baudrate: NmeaBaudRate) => {
      if (baudrate === 38400 && !hasAccess('ais_stream', config.marine_tools_config)) {
        appendLog(
          'AIS LOCKED',
          '/connect_nmea',
          '38400 baud (AISStream) verrouillé sur plan Gratuit — passez en Premium'
        );
        showToast('AISStream (38400 baud) réservé Premium — activez un plan dans Agent MCP');
        return;
      }

      const protocolMode: 'NMEA 0183' | 'NMEA 0183 + AIS' =
        baudrate === 38400 ? 'NMEA 0183 + AIS' : 'NMEA 0183';
      setConfig((prev) => ({
        ...prev,
        gnss_nmea: {
          ...prev.gnss_nmea,
          nmea_connected: true,
          nmea_port: port,
          baudrate,
          protocol_mode: protocolMode,
        },
      }));
      setTelemetry((prev) => ({
        ...prev,
        nmeaSentence: buildNmeaSentence(VESSEL_LAT, VESSEL_LON, prev.sog, prev.cog, baudrate),
      }));
      setIsConfigDirty(true);
      appendLog(
        'NMEA PORT',
        '/connect_nmea',
        `Port ${port} connecté à ${baudrate} baud (${protocolMode})`
      );
      showToast(`NMEA connecté : ${port} @ ${baudrate} baud (${protocolMode})`);
    },
    [config.marine_tools_config, appendLog, showToast]
  );

  const handleGetStatusGnss = useCallback(() => {
    const gnss = config.gnss_nmea;
    const totalSats =
      (gnss.constellations.gps ? telemetry.satellites.gps : 0) +
      (gnss.constellations.glonass ? telemetry.satellites.glonass : 0) +
      (gnss.constellations.galileo ? telemetry.satellites.galileo : 0);
    const permText =
      gnss.android_permission === 'always'
        ? 'Toujours autoriser (OK)'
        : 'Attention : autorisation Android incomplète';
    const detail = `Fix=${telemetry.satellites.fixType} · Sats=${totalSats} · HDOP=${telemetry.satellites.hdop} · Antenne=${gnss.antenna_clear_sky ? 'Dégagée' : 'Obstruée'} · Android=${permText} · AISStream=${hasAccess('ais_stream', config.marine_tools_config) ? 'UNLOCKED' : 'LOCKED'} · visionia_memoire=${trackMemoire.length} pts`;
    appendLog('STATUS GNSS', '/get_status --gnss', detail);
    showToast(
      `Diagnostic GNSS : ${totalSats} sats (${telemetry.satellites.fixType}) · HDOP ${telemetry.satellites.hdop}`
    );
  }, [config.gnss_nmea, config.marine_tools_config, telemetry.satellites, trackMemoire.length, appendLog, showToast]);

  const handleScanAreaOllama = useCallback(
    (radiusM: number) => {
      if (config.mcp_agent.ai_transit_sleep) {
        appendLog(
          'IA VEILLE',
          '/ollama --scan_area',
          'Scan bloqué : IA désactivée pour le déplacement (réactivez IA Active)'
        );
        showToast('IA en veille de déplacement — réactivez Poissons IA / Ollama');
        return {
          species: 'IA en veille (économie ressources)',
          conf: 'VEILLE',
          zone: `R: ${radiusM}m`,
        };
      }

      const targetLat = 36.9045;
      const targetLon = 6.886;
      const canAutoGenerate = fishVisible;
      const nextNum = waypoints.length + 1;

      if (canAutoGenerate) {
        const autoWp = buildWaypointFromCsvRow(
          {
            name: `Banc Bathy Stora (${radiusM}m) #${nextNum}`,
            lat: +(targetLat + (Math.random() - 0.5) * 0.014).toFixed(4),
            lon: +(targetLon + (Math.random() - 0.5) * 0.016).toFixed(4),
            depth: +(22 + Math.random() * 14).toFixed(1),
            type: 'fish',
            sourceFile: 'ollama --scan_area',
          },
          nextNum
        );
        setWaypoints((prev) => [autoWp, ...prev]);
        setActiveWaypointId(autoWp.id);
        setIsConfigDirty(true);
      }

      setConfig((prev) => ({
        ...prev,
        mcp_agent: {
          ...prev.mcp_agent,
          scan_radius_m: radiusM,
        },
      }));
      setActiveScanArea({
        lat: targetLat,
        lon: targetLon,
        radiusM,
        label: 'Stora',
        generatedCount: canAutoGenerate ? 1 : 0,
      });
      setTelemetry((prev) => ({
        ...prev,
        memoryBufferMb: Math.min(512, prev.memoryBufferMb + 64),
      }));

      const pick = {
        species: canAutoGenerate
          ? `WP-${String(nextNum).padStart(2, '0')} généré · Banc pélagique Stora`
          : `Bathymétrie scannée (${radiusM}m) · Activez Poissons IA pour générer WP`,
        conf: '95% CONF.',
        zone: `R: ${radiusM}m`,
      };

      appendLog(
        'OLLAMA SCAN',
        `/ollama --scan_area --radius "${radiusM}m"`,
        canAutoGenerate
          ? `Analyse bathymétrique Stora (${radiusM}m) -> WP-${String(nextNum).padStart(2, '0')} généré`
          : `Analyse bathymétrique Stora (${radiusM}m) terminée (Poissons IA OFF)`
      );
      showToast(
        canAutoGenerate
          ? `Scan ${radiusM}m : WP-${String(nextNum).padStart(2, '0')} ajouté sur Stora`
          : `Scan bathymétrique ${radiusM}m affiché`
      );
      return pick;
    },
    [config.mcp_agent.ai_transit_sleep, fishVisible, waypoints.length, appendLog, showToast]
  );

  const handleExtractJson = useCallback(() => {
    const updated = exportOptimizationJson(syncedConfig, waypoints);
    setConfig(updated);
    setIsConfigDirty(false);
    const freed = Math.max(0, telemetry.memoryBufferMb - 42);
    setTelemetry((prev) => ({
      ...prev,
      memoryBufferMb: 42,
    }));
    appendLog(
      'SYNC',
      'Extraire JSON',
      `visionia_optimization.json extrait (marine_tools_config + MARINE_GPS_TRACKER + ${waypoints.length} pts) · ${freed} Mo libérés`
    );
    showToast(`JSON extrait · ${freed} Mo de mémoire libérés`);
  }, [syncedConfig, waypoints, telemetry.memoryBufferMb, appendLog, showToast]);

  const handleExportXlsx = useCallback(() => {
    exportWaypointsXlsx(waypoints, trackMemoire, pointsInteret);
    appendLog(
      'EXPORT',
      'Excel',
      `donnees_visionia.xlsx généré (${waypoints.length} waypoints + ${pointsInteret.length} POI + ${trackMemoire.length} pts visionia_memoire)`
    );
    showToast('Export Excel : donnees_visionia.xlsx téléchargé');
  }, [waypoints, trackMemoire, pointsInteret, appendLog, showToast]);

  const handleExport = useCallback(
    (fmt: 'PDF' | 'XLSX' | 'JSON') => {
      if (fmt === 'JSON') {
        handleExtractJson();
      } else if (fmt === 'XLSX') {
        handleExportXlsx();
      } else {
        setModal({ type: 'pdf' });
        appendLog(
          'EXPORT',
          'Rapport PDF',
          `Aperçu rapport structure & navigation (${activeZone.label}) préparé`
        );
      }
    },
    [handleExtractJson, handleExportXlsx, activeZone.label, appendLog]
  );

  const handleOpenSyncScript = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      gnss_nmea: {
        ...prev.gnss_nmea,
        auto_sync_xlsx: true,
      },
    }));
    setModal({ type: 'sync-script' });
    appendLog(
      'SCRIPT SYNC',
      'donnees_visionia.xlsx',
      `Script sync_visionia_xlsx.py généré (${config.gnss_nmea.nmea_port} @ ${config.gnss_nmea.baudrate} baud)`
    );
  }, [config.gnss_nmea.nmea_port, config.gnss_nmea.baudrate, appendLog]);

  const handlePwaCheckUpdate = useCallback(
    async (forceSkipWaiting = false) => {
      if ('serviceWorker' in navigator) {
        try {
          const reg =
            window.__marineSwRegistration || (await navigator.serviceWorker.getRegistration('/'));
          if (reg) {
            await reg.update();
            if (forceSkipWaiting && reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        } catch {
          // Ignore preview sandbox SW limits gracefully
        }
      }
      appendLog(
        'PWA UPDATE',
        '/service-worker.js',
        `Stratégie Network-First vérifiée · self.skipWaiting() ${forceSkipWaiting ? 'forcé' : 'prêt'} · anti-cache actif`
      );
      showToast('PWA Android : vérification Service Worker effectuée');
    },
    [appendLog, showToast]
  );

  const handleSyncNetlify = useCallback(() => {
    const nowIso = new Date().toISOString();
    setConfig((prev) => ({
      ...prev,
      pwa_deploy: {
        ...prev.pwa_deploy,
        last_deploy_at: nowIso,
      },
    }));
    setIsConfigDirty(true);
    appendLog(
      'NETLIFY CI/CD',
      '/netlify_sync',
      `Sync GitHub (${config.pwa_deploy.github_repo}@${config.pwa_deploy.github_branch}) → ${config.pwa_deploy.netlify_site} (auto-publish=${String(config.pwa_deploy.netlify_auto_publish)})`
    );
    showToast(`Pipeline GitHub → ${config.pwa_deploy.netlify_site} synchronisé`);
  }, [
    config.pwa_deploy.github_repo,
    config.pwa_deploy.github_branch,
    config.pwa_deploy.netlify_site,
    config.pwa_deploy.netlify_auto_publish,
    appendLog,
    showToast,
  ]);

  const handleExportNetlifyToml = useCallback(() => {
    exportNetlifyToml();
    appendLog(
      'EXPORT',
      'netlify.toml',
      'Configuration anti-cache HTTP & Permissions-Policy (geolocation, camera) téléchargée'
    );
    showToast('netlify.toml téléchargé');
  }, [appendLog, showToast]);

  const handleActivateLicenseCode = useCallback(
    (rawCode: string, provider: 'Manuel' | 'Stripe' | 'PayPal' = 'Manuel') => {
      const check = validateLicenseCode(rawCode);
      if (!check.valid) {
        appendLog(
          'LICENCE',
          'visionia_memoire',
          `Code invalide : "${rawCode}" (format attendu : MV-YEAR-2026, MV-LIFE-MED, MV-WEEK-SKIKDA)`
        );
        showToast('Code licence invalide (ex : MV-YEAR-2026)');
        return;
      }
      const nextLicense: ManualLicenseRecord = {
        code: check.normalized,
        tier: check.tier,
        provider,
        status: 'active',
        activatedAt: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        storedIn: 'visionia_memoire',
      };
      setManualLicense(nextLicense);
      setConfig((prev) => ({
        ...prev,
        marine_tools_config: {
          ...prev.marine_tools_config,
          active_plan: check.tier,
        },
      }));
      setIsConfigDirty(true);
      appendLog(
        'LICENCE',
        `visionia_memoire (${provider})`,
        `Code ${check.normalized} activé → ${getTierLabel(check.tier)} (hasAccess déverrouillé)`
      );
      showToast(`Licence ${check.normalized} activée dans visionia_memoire`);
    },
    [appendLog, showToast]
  );

  const handleRevokeLicense = useCallback(() => {
    setManualLicense(EMPTY_MANUAL_LICENSE);
    setConfig((prev) => ({
      ...prev,
      marine_tools_config: {
        ...prev.marine_tools_config,
        active_plan: 'free',
      },
    }));
    setIsConfigDirty(true);
    appendLog('LICENCE', 'visionia_memoire', 'Licence révoquée — retour au plan Gratuit');
    showToast('Licence révoquée — retour en mode Gratuit');
  }, [appendLog, showToast]);

  const handlePurchaseTurnkey = useCallback(
    (provider: 'Stripe' | 'PayPal', tier: Exclude<SubscriptionTier, 'free'>) => {
      const suffix = provider === 'PayPal' ? 'PP26' : 'ST26';
      const prefix =
        tier === 'monthly' || tier === 'weekly'
          ? 'MV-1M'
          : tier === 'quarterly'
            ? 'MV-3M'
            : 'MV-1Y';
      handleActivateLicenseCode(`${prefix}-${suffix}`, provider);
    },
    [handleActivateLicenseCode]
  );

  const handleExportMedPoisJson = useCallback(() => {
    exportMedPointsInteretJson(pointsInteret);
    appendLog(
      'EXPORT POI',
      'points_interet_mediterranee.json',
      `${pointsInteret.length} PointsInteret Méditerranée exportés (Geofencing + $GNRMC)`
    );
    showToast('points_interet_mediterranee.json téléchargé');
  }, [pointsInteret, appendLog, showToast]);

  const handleCapturePoiFromGnrmc = useCallback(() => {
    const parsed = parseGnrmcCoords(telemetry.nmeaSentence);
    const lat = parsed?.lat ?? VESSEL_LAT;
    const lon = parsed?.lon ?? VESSEL_LON;
    const nextNum = pointsInteret.length + 1;
    const newPoi: PointInteretMed = {
      id: `POI-MED-${String(nextNum).padStart(2, '0')}`,
      nom: `Capture $GNRMC Skikda #${nextNum}`,
      secteur: 'Golfe de Skikda · Méditerranée',
      lat,
      lon,
      rayon_m: 500,
      type: 'peche',
      alerte_collision_ia: hasAccess('collision_ai_alerts', config.marine_tools_config),
      source_nmea: '$GNRMC',
    };
    setPointsInteret((prev) => [newPoi, ...prev]);
    setIsConfigDirty(true);
    appendLog(
      'NMEA $GNRMC',
      'PointsInteret',
      `${newPoi.id} capturé depuis $GNRMC (${lat}, ${lon} · rayon ${newPoi.rayon_m}m)`
    );
    showToast(`POI Méditerranée ajouté depuis $GNRMC (${lat}°N, ${lon}°E)`);
  }, [
    telemetry.nmeaSentence,
    pointsInteret.length,
    config.marine_tools_config,
    appendLog,
    showToast,
  ]);

  const handleTogglePoiAiAlert = useCallback(
    (poiId: string) => {
      if (!hasAccess('collision_ai_alerts', config.marine_tools_config)) {
        appendLog(
          'PREMIUM LOCK',
          `hasAccess('collision_ai_alerts')`,
          'Alertes Collision IA verrouillées — activez une licence ou un plan Premium'
        );
        showToast('Alertes Collision IA réservées Premium — activez une licence');
        return;
      }
      setPointsInteret((prev) =>
        prev.map((p) =>
          p.id === poiId ? { ...p, alerte_collision_ia: !p.alerte_collision_ia } : p
        )
      );
      setIsConfigDirty(true);
      showToast('Alerte Collision IA mise à jour');
    },
    [config.marine_tools_config, appendLog, showToast]
  );

  const handleChangeNavigationZone = useCallback(
    (zoneId: NavigationZoneId) => {
      const zone = getNavigationZone(zoneId);
      setConfig((prev) => ({
        ...prev,
        region: zone.label,
        active_zone_id: zone.id,
        lieux_navigation_ui: {
          ...(prev.lieux_navigation_ui || DEFAULT_MCP_CONFIG.lieux_navigation_ui!),
          selected_zone: zone.id,
        },
      }));
      const firstInZone = waypoints.find((w) => (w.zoneId || 'skikda') === zone.id);
      if (firstInZone) {
        setActiveWaypointId(firstInZone.id);
      }
      setIsConfigDirty(true);
      appendLog(
        'ZONE NAV',
        'Lieux & Navigation',
        `Secteur actif basculé vers "${zone.label}" (${zone.subtitle})`
      );
      showToast(`Zone active : ${zone.label}`);
    },
    [waypoints, appendLog, showToast]
  );

  const handleOpenManualPointModal = useCallback(() => {
    setManualName('');
    setManualLat(activeZone.centerLat.toFixed(4));
    setManualLon(activeZone.centerLon.toFixed(4));
    setManualDepth('24');
    setManualCategory('anchor');
    setManualZoneId(activeZone.id);
    setManualError(null);
    setModal({ type: 'manual-point' });
  }, [activeZone]);

  const handleAddManualPoint = useCallback(
    (input: {
      name: string;
      lat: number;
      lon: number;
      depth: number;
      category: WaypointCategory;
      zoneId: NavigationZoneId;
    }) => {
      const cleanName = input.name.trim() || `Point Manuel #${waypoints.length + 1}`;
      const cleanLat = +input.lat.toFixed(5);
      const cleanLon = +input.lon.toFixed(5);
      const nextIdx = waypoints.length + 1;
      const wp = buildWaypointFromCsvRow(
        {
          name: cleanName,
          lat: cleanLat,
          lon: cleanLon,
          depth: input.depth,
          type: input.category,
          sourceFile: 'Saisie manuelle',
          zoneId: input.zoneId,
          isManual: true,
        },
        nextIdx
      );
      setWaypoints((prev) => [wp, ...prev]);
      setActiveWaypointId(wp.id);

      const zoneObj = getNavigationZone(input.zoneId);
      const poiType: PointInteretMed['type'] =
        input.category === 'fish'
          ? 'peche'
          : input.category === 'restricted' || input.category === 'wreck'
            ? 'danger'
            : 'mouillage';
      const nextPoi: PointInteretMed = {
        id: `POI-MED-${String(pointsInteret.length + 1).padStart(2, '0')}`,
        nom: cleanName,
        secteur: zoneObj.subtitle,
        bassin: zoneObj.label,
        pays: 'Méditerranée',
        lat: cleanLat,
        lon: cleanLon,
        rayon_m: 500,
        type: poiType,
        alerte_collision_ia: hasAccess('collision_ai_alerts', config.marine_tools_config),
        source_nmea: '$GNRMC',
        tags: [zoneObj.id, poiType, cleanName.toLowerCase()],
        rag_indexed: true,
      };
      setPointsInteret((prev) => [nextPoi, ...prev]);
      setRagIndex(buildLocalRagIndex([nextPoi, ...pointsInteret], NAVIGATION_ZONES));

      setIsConfigDirty(true);
      appendLog(
        'POINT MANUEL',
        zoneObj.label,
        `${wp.id} / ${nextPoi.id} « ${cleanName} » (${cleanLat.toFixed(4)}, ${cleanLon.toFixed(4)} · ${wp.depthM}m)`
      );
      showToast(`Point « ${cleanName} » ajouté au GPS & PointsInteret (${zoneObj.label})`);
    },
    [
      waypoints.length,
      pointsInteret,
      config.marine_tools_config,
      appendLog,
      showToast,
    ]
  );

  const handleConfirmManualPoint = useCallback(() => {
    const parsedLat = parseFloat(manualLat.replace(',', '.'));
    const parsedLon = parseFloat(manualLon.replace(',', '.'));
    const parsedDepth = parseFloat(manualDepth.replace(',', '.'));

    if (!manualName.trim()) {
      setManualError('Veuillez saisir un nom pour ce point.');
      return;
    }
    if (Number.isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setManualError('Latitude invalide (attendu entre -90 et 90, ex: 36.9350).');
      return;
    }
    if (Number.isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
      setManualError('Longitude invalide (attendu entre -180 et 180, ex: 6.9550).');
      return;
    }

    handleAddManualPoint({
      name: manualName.trim(),
      lat: parsedLat,
      lon: parsedLon,
      depth: Number.isNaN(parsedDepth) || parsedDepth <= 0 ? 24 : parsedDepth,
      category: manualCategory,
      zoneId: manualZoneId,
    });
    if (manualZoneId !== activeZone.id) {
      handleChangeNavigationZone(manualZoneId);
    }
    setManualError(null);
    setModal({ type: 'none' });
  }, [
    manualName,
    manualLat,
    manualLon,
    manualDepth,
    manualCategory,
    manualZoneId,
    activeZone.id,
    handleAddManualPoint,
    handleChangeNavigationZone,
  ]);

  const handleExportLieuxNavJson = useCallback(() => {
    exportLieuxNavigationConfigJson(syncedConfig, waypoints);
    appendLog(
      'EXPORT JSON',
      'lieux_navigation_config.json',
      `Configuration Lieux & Navigation exportée (zone: ${activeZone.label}, ${waypoints.length} points)`
    );
    showToast('lieux_navigation_config.json téléchargé');
  }, [syncedConfig, waypoints, activeZone.label, appendLog, showToast]);

  const handleIndexRagDatabase = useCallback(() => {
    const nextIndex = buildLocalRagIndex(pointsInteret, NAVIGATION_ZONES);
    setRagIndex(nextIndex);
    try {
      localStorage.setItem(RAG_MEMOIRE_KEY, JSON.stringify(nextIndex));
    } catch {
      // ignore
    }
    const entry: MemoireDecision = {
      id: `MEM-${String(memoireDecisions.length + 1).padStart(2, '0')}`,
      note: `Structure MarineVision Méditerranée indexée dans RAG local (${nextIndex.total_docs} fiches géo-référencées)`,
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMemoireDecisions((prev) => [entry, ...prev]);
    setIsConfigDirty(true);
    appendLog(
      'RAG LOCAL',
      'visionia_memoire_rag',
      `${nextIndex.total_docs} fiches Méditerranée indexées (Skikda, Marseille, La Maddalena, Lavezzi, Cap Bon, Kornati, Costa Brava, Al Hoceïma)`
    );
    showToast(`RAG local indexé : ${nextIndex.total_docs} fiches Méditerranée`);
  }, [pointsInteret, memoireDecisions.length, appendLog, showToast]);

  const handleOpenImplScriptModal = useCallback(
    (lang: 'javascript' | 'python') => {
      setModal({ type: 'impl-script', lang });
      appendLog(
        'SCRIPT MENU',
        lang === 'python' ? 'marinevision_mediterranee_menu.py' : 'marinevision_mediterranee_menu.js',
        `Script d'implémentation ${lang.toUpperCase()} généré (menu sélection + Haversine GPS)`
      );
    },
    [appendLog]
  );

  const handleExecuteMcpCommand = useCallback(
    (rawCmd: string) => {
      const cmd = String(rawCmd || '').trim();
      if (!cmd) return;

      if (cmd.startsWith('/set_mode')) {
        const wantAdmin = /--admin/i.test(cmd);
        handleToggleAdminMode(wantAdmin);
        return;
      }

      if (cmd.startsWith('/share_app')) {
        const guest = !/--admin/i.test(cmd);
        void partagerApp(guest);
        return;
      }

      if (cmd.startsWith('/gen_qrcode')) {
        const guest = !/--admin/i.test(cmd);
        handleOpenQrShare(guest);
        return;
      }

      if (cmd.startsWith('/pwa_check_update')) {
        const forceSkip = /--force_skip_waiting/i.test(cmd);
        void handlePwaCheckUpdate(forceSkip);
        return;
      }

      if (cmd.startsWith('/netlify_sync')) {
        const branchMatch = cmd.match(/--branch\s+["']?([^"'\s]+)["']?/i);
        if (branchMatch) {
          setConfig((prev) => ({
            ...prev,
            pwa_deploy: { ...prev.pwa_deploy, github_branch: branchMatch[1] },
          }));
        }
        handleSyncNetlify();
        return;
      }

      if (cmd.startsWith('/set_plan')) {
        const tierMatch = cmd.match(/--tier\s+["']?([a-z0-9_]+)["']?/i);
        const validTier = normalizeSubscriptionTier(tierMatch?.[1] || 'monthly');
        handleSelectPlan(validTier);
        return;
      }

      if (cmd.startsWith('/check_access')) {
        const featMatch = cmd.match(/--feature\s+["']?([a-z0-9_]+)["']?/i);
        const rawFeat = (featMatch?.[1] || 'ais_stream') as MarineFeatureKey;
        const validFeat: MarineFeatureKey =
          rawFeat in config.marine_tools_config.features ? rawFeat : 'ais_stream';
        handleTestHasAccess(validFeat);
        return;
      }

      if (cmd.startsWith('/revise_pricing')) {
        const wkMatch = cmd.match(/--weekly\s+["']?([\d.]+)["']?/i);
        const price = wkMatch ? parseFloat(wkMatch[1]) : 4.99;
        handleReviseWeeklyPrice(Number.isNaN(price) ? 4.99 : price);
        return;
      }

      if (cmd.startsWith('/system_hook')) {
        const enableMatch = cmd.match(/--enable_sensor\s+["']?([^"'\s]+)["']?/i);
        const disableMatch = cmd.match(/--disable_sensor\s+["']?([^"'\s]+)["']?/i);
        if (disableMatch) {
          handleEnableSystemHook(disableMatch[1], false);
        } else {
          handleEnableSystemHook(enableMatch ? enableMatch[1] : 'GNSS_L5', true);
        }
        return;
      }

      if (cmd.startsWith('/set_auto_log')) {
        const intMatch = cmd.match(/--interval\s+["']?(\d+)s?["']?/i);
        const targetMatch = cmd.match(/--target\s+["']?([^"'\s]+)["']?/i);
        const intervalSec = intMatch
          ? Math.max(10, Math.min(3600, parseInt(intMatch[1], 10)))
          : 60;
        const targetFile = targetMatch ? targetMatch[1] : 'donnees_visionia.xlsx';
        handleSetAutoLog(intervalSec, targetFile);
        return;
      }

      if (cmd.startsWith('/gnss_reset')) {
        const forceOn = /--force_on/i.test(cmd);
        const intMatch = cmd.match(/--update_interval\s+(\d+)/i);
        const intervalMs = intMatch
          ? Math.max(200, Math.min(10000, parseInt(intMatch[1], 10)))
          : 1000;
        handleGnssReset(forceOn || true, intervalMs);
        return;
      }

      if (cmd.startsWith('/connect_nmea')) {
        const portMatch = cmd.match(/--port\s+([^\s]+)/i);
        const baudMatch = cmd.match(/--baudrate\s+(\d+)/i);
        const port = portMatch ? portMatch[1].replace(/^["']|["']$/g, '') : '/dev/ttyUSB0';
        const rawBaud = baudMatch ? parseInt(baudMatch[1], 10) : 4800;
        const baudrate: NmeaBaudRate = rawBaud === 38400 ? 38400 : 4800;
        handleConnectNmea(port, baudrate);
        return;
      }

      if (cmd.startsWith('/get_status')) {
        handleGetStatusGnss();
        return;
      }

      if (cmd.startsWith('/sync_xlsx')) {
        handleOpenSyncScript();
        return;
      }

      if (cmd.startsWith('/gnss_sync')) {
        handleGnssSync();
        return;
      }

      if (cmd.startsWith('/ollama')) {
        const radMatch = cmd.match(/--radius\s+["']?(\d+)m?["']?/i);
        const radiusM = radMatch ? Math.max(100, Math.min(2500, parseInt(radMatch[1], 10))) : 500;
        handleScanAreaOllama(radiusM);
        return;
      }

      if (cmd.startsWith('/geofence')) {
        const radMatch = cmd.match(/--radius\s+["']?(\d+)m?["']?/i);
        const zoneMatch = cmd.match(/--zone\s+["']([^"']+)["']/i);
        const disable = /--disable/i.test(cmd);
        const nextRadius = radMatch
          ? Math.max(300, Math.min(2000, parseInt(radMatch[1], 10)))
          : config.geofence.radius_m;
        const nextZone = zoneMatch ? zoneMatch[1] : config.geofence.zone_name;
        const nextEnabled = !disable;

        setConfig((prev) => ({
          ...prev,
          geofence: {
            ...prev.geofence,
            enabled: nextEnabled,
            zone_name: nextZone,
            radius_m: nextRadius,
          },
        }));
        setIsConfigDirty(true);
        appendLog(
          'GEOFENCE',
          '/geofence',
          `${nextZone} · rayon ${nextRadius}m · ${nextEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`
        );
        showToast(
          nextEnabled
            ? `Geofence ${nextZone} activé (${nextRadius} m)`
            : `Geofence ${nextZone} désactivé`
        );
        return;
      }

      if (cmd.startsWith('/extract_json')) {
        handleExtractJson();
        return;
      }

      if (cmd.startsWith('/export_xlsx') || cmd.startsWith('/excel')) {
        handleExportXlsx();
        return;
      }

      if (cmd.startsWith('/pdf')) {
        handleExport('PDF');
        return;
      }

      if (cmd.startsWith('/memoire')) {
        const noteMatch = cmd.match(/--note\s+"([^"]+)"/i);
        const note =
          noteMatch?.[1] ||
          cmd.replace(/^\/memoire\s*/i, '').trim() ||
          `Contexte MarineVision AI validé (${PROJECT_CONTACT.phone} · ${PROJECT_CONTACT.email} · 20€/50€/100€ · ${pointsInteret.length} POI)`;
        const entry: MemoireDecision = {
          id: `MEM-${String(memoireDecisions.length + 1).padStart(2, '0')}`,
          note,
          timestamp: new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setMemoireDecisions((prev) => [entry, ...prev]);
        setIsConfigDirty(true);
        appendLog('MEMOIRE', 'visionia_memoire', `${entry.id} : ${note}`);
        showToast(`Persisté dans visionia_memoire (${entry.id})`);
        return;
      }

      if (cmd.startsWith('/activate_license')) {
        const codeMatch = cmd.match(/--code\s+"?([^"\s]+)"?/i);
        const code = codeMatch?.[1] || 'MV-1Y-2026';
        handleActivateLicenseCode(code, 'Manuel');
        return;
      }

      if (cmd.startsWith('/export_med_poi')) {
        handleExportMedPoisJson();
        return;
      }

      if (cmd.startsWith('/rag_index')) {
        handleIndexRagDatabase();
        return;
      }

      if (cmd.startsWith('/gen_script')) {
        const langMatch = cmd.match(/--lang\s+["']?([a-z]+)["']?/i);
        const rawLang = (langMatch?.[1] || 'javascript').toLowerCase();
        const lang: 'javascript' | 'python' =
          rawLang === 'py' || rawLang === 'python' ? 'python' : 'javascript';
        handleOpenImplScriptModal(lang);
        return;
      }

      if (cmd.startsWith('/set_zone')) {
        const zoneMatch = cmd.match(/--zone\s+["']?([a-z_]+)["']?/i);
        const rawZ = (zoneMatch?.[1] || 'skikda').toLowerCase();
        const validZ = NAVIGATION_ZONES.some((z) => z.id === rawZ)
          ? (rawZ as NavigationZoneId)
          : 'skikda';
        handleChangeNavigationZone(validZ);
        return;
      }

      if (cmd.startsWith('/add_point') || cmd.startsWith('/add_poi')) {
        const nameMatch = cmd.match(/--name\s+["']([^"']+)["']/i);
        const latMatch = cmd.match(/--lat\s+([-\d.]+)/i);
        const lonMatch = cmd.match(/--lon\s+([-\d.]+)/i);
        const zoneMatch = cmd.match(/--zone\s+["']?([a-z_]+)["']?/i);
        const catMatch = cmd.match(/--type\s+["']?([a-z]+)["']?/i);
        const targetZone =
          zoneMatch && NAVIGATION_ZONES.some((z) => z.id === zoneMatch[1].toLowerCase())
            ? (zoneMatch[1].toLowerCase() as NavigationZoneId)
            : activeZone.id;
        const zoneCfg = getNavigationZone(targetZone);
        const lat = latMatch ? parseFloat(latMatch[1]) : zoneCfg.centerLat;
        const lon = lonMatch ? parseFloat(lonMatch[1]) : zoneCfg.centerLon;
        const rawCat = (catMatch?.[1] || 'anchor').toLowerCase();
        const category: WaypointCategory =
          rawCat === 'fish' || rawCat === 'wreck' || rawCat === 'restricted'
            ? rawCat
            : 'anchor';
        handleAddManualPoint({
          name: nameMatch?.[1] || 'Repère MCP Manuel',
          lat: Number.isNaN(lat) ? zoneCfg.centerLat : lat,
          lon: Number.isNaN(lon) ? zoneCfg.centerLon : lon,
          depth: 28,
          category,
          zoneId: targetZone,
        });
        return;
      }

      if (cmd.startsWith('/clear_logs')) {
        setLogs([]);
        showToast('Journal MCP effacé');
        return;
      }

      if (cmd.startsWith('/import_data')) {
        const srcMatch = cmd.match(/--source\s+"([^"]+)"/);
        const procMatch = cmd.match(/--process_type\s+"([^"]+)"/);
        const modeMatch = cmd.match(/--mode\s+"([^"]+)"/);
        const source = srcMatch ? srcMatch[1] : 'skikda_points.csv';
        const processType = procMatch ? procMatch[1] : 'map_overlay';
        const mode = modeMatch ? modeMatch[1] : 'auto_detect';

        const parsed = parseSkikdaCsvText(SAMPLE_SKIKDA_CSV, source).map((row, idx) =>
          buildWaypointFromCsvRow(row, idx + 1)
        );
        setWaypoints(parsed);
        setActiveWaypointId(parsed[0]?.id || 'WP-01');
        setConfig((prev) => ({
          ...prev,
          mcp_agent: {
            ...prev.mcp_agent,
            process_type: processType,
            mode,
          },
        }));
        setTelemetry((prev) => ({
          ...prev,
          memoryBufferMb: Math.min(512, prev.memoryBufferMb + 48),
        }));
        setIsConfigDirty(false);
        appendLog(
          'MCP CMD',
          '/import_data',
          `source="${source}" · process_type="${processType}" · mode="${mode}" -> ${parsed.length} points traités`
        );
        showToast(`MCP : ${parsed.length} points chargés (${processType})`);
        return;
      }

      showToast(
        'Commande non reconnue. Essayez /memoire, /check_access, /system_hook ou /gnss_sync'
      );
    },
    [
      config.marine_tools_config.features,
      memoireDecisions.length,
      handlePwaCheckUpdate,
      handleSyncNetlify,
      handleSelectPlan,
      handleTestHasAccess,
      handleReviseWeeklyPrice,
      handleEnableSystemHook,
      handleSetAutoLog,
      handleGnssReset,
      handleConnectNmea,
      handleGetStatusGnss,
      handleOpenSyncScript,
      handleGnssSync,
      handleScanAreaOllama,
      config.geofence.radius_m,
      config.geofence.zone_name,
      handleExtractJson,
      handleExportXlsx,
      handleExport,
      pointsInteret.length,
      handleActivateLicenseCode,
      handleExportMedPoisJson,
      handleIndexRagDatabase,
      handleOpenImplScriptModal,
      handleChangeNavigationZone,
      handleAddManualPoint,
      activeZone.centerLat,
      activeZone.centerLon,
      activeZone.id,
      handleToggleAdminMode,
      partagerApp,
      handleOpenQrShare,
      appendLog,
      showToast,
    ]
  );

  const handleStartCapturePosition = useCallback(() => {
    setIsCapturingPosition(true);
    setPlaceNameInput('');
    setPlaceCategoryInput('anchor');

    const openSavePlaceModal = (
      lat: number,
      lon: number,
      accuracyM: number,
      source: 'navigator.geolocation' | 'gnss_fallback'
    ) => {
      setIsCapturingPosition(false);
      setModal({
        type: 'save-place',
        lat: +lat.toFixed(5),
        lon: +lon.toFixed(5),
        accuracyM: +accuracyM.toFixed(1),
        source,
      });
    };

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          openSavePlaceModal(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy || 5,
            'navigator.geolocation'
          );
        },
        () => {
          openSavePlaceModal(
            VESSEL_LAT,
            VESSEL_LON,
            telemetry.gnssSynced ? 0.4 : 4.2,
            'gnss_fallback'
          );
          showToast('GPS navigateur indisponible — position GNSS embarquée capturée');
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    } else {
      openSavePlaceModal(
        VESSEL_LAT,
        VESSEL_LON,
        telemetry.gnssSynced ? 0.4 : 4.2,
        'gnss_fallback'
      );
    }
  }, [telemetry.gnssSynced, showToast]);

  const handleConfirmSavePlace = () => {
    if (modal.type !== 'save-place') return;
    const cleanName =
      placeNameInput.trim() || `Lieu Skikda #${savedPlaces.length + 1}`;
    const nextIdx = waypoints.length + 1;
    const newWp = buildWaypointFromCsvRow(
      {
        name: cleanName,
        lat: modal.lat,
        lon: modal.lon,
        depth: Math.round(telemetry.chirpDepth),
        type: placeCategoryInput,
        sourceFile: modal.source,
        zoneId: activeZone.id,
      },
      nextIdx
    );

    const record: SavedPlaceRecord = {
      id: `PLACE-${String(savedPlaces.length + 1).padStart(2, '0')}`,
      name: cleanName,
      lat: modal.lat,
      lon: modal.lon,
      accuracyM: modal.accuracyM,
      category: placeCategoryInput,
      source: modal.source,
      createdAt: new Date().toISOString(),
      waypointId: newWp.id,
    };

    setSavedPlaces((prev) => [record, ...prev]);
    setWaypoints((prev) => [newWp, ...prev]);
    setActiveWaypointId(newWp.id);
    setIsConfigDirty(true);
    setModal({ type: 'none' });
    appendLog(
      'GPS PIN',
      modal.source,
      `Lieu « ${cleanName} » enregistré (${record.lat}, ${record.lon}) → épingle ${newWp.id}`
    );
    showToast(`Épingle « ${cleanName} » enregistrée sur la carte`);
  };

  const handleImportFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const rows = file.name.toLowerCase().endsWith('.gpx')
          ? parseGpxText(text, file.name)
          : parseSkikdaCsvText(text, file.name);

        if (!rows.length) {
          showToast('Format invalide : vérifiez les colonnes name, lat, long, depth, type');
          return;
        }

        const startIdx = waypoints.length;
        const imported = rows.map((row, idx) => buildWaypointFromCsvRow(row, startIdx + idx + 1));

        setWaypoints((prev) => [...imported, ...prev]);
        setImportHistory((prev) => [
          {
            date: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            file: file.name,
            count: imported.length,
          },
          ...prev,
        ]);
        setTelemetry((prev) => ({
          ...prev,
          memoryBufferMb: Math.min(512, prev.memoryBufferMb + imported.length * 18),
        }));
        setIsConfigDirty(true);
        appendLog('SYNC', 'Import NAV', `${imported.length} point(s) importé(s) depuis ${file.name}`);
        showToast(`${imported.length} point(s) importé(s) — cliquez Extraire JSON pour libérer`);
      };
      reader.readAsText(file);
    },
    [waypoints.length, appendLog, showToast]
  );

  const handleActivateWaypoint = useCallback(
    (id: string) => {
      const wp = waypoints.find((w) => w.id === id);
      if (!wp) return;
      setActiveWaypointId(wp.id);
      setTelemetry((prev) => ({ ...prev, cog: wp.bearing }));
      appendLog('ROUTING', 'Naviguer vers', `Cap ${wp.bearing}° vers ${wp.name} (${wp.distanceNm} NM)`);
      showToast(`Route active : ${wp.name} (Cap ${wp.bearing}°)`);
    },
    [waypoints, appendLog, showToast]
  );

  const handleCreateSonarWaypoint = useCallback(() => {
    const nextNum = waypoints.length + 1;
    const wp = buildWaypointFromCsvRow(
      {
        name: `Contact Sonar Skikda #${nextNum}`,
        lat: +(VESSEL_LAT + (Math.random() - 0.5) * 0.04).toFixed(4),
        lon: +(VESSEL_LON + (Math.random() - 0.5) * 0.04).toFixed(4),
        depth: Math.round(telemetry.chirpDepth),
        type: 'fish',
        sourceFile: 'Sonar CHIRP',
      },
      nextNum
    );
    setWaypoints((prev) => [wp, ...prev]);
    setActiveWaypointId(wp.id);
    setTelemetry((prev) => ({
      ...prev,
      memoryBufferMb: Math.min(512, prev.memoryBufferMb + 24),
    }));
    setIsConfigDirty(true);
    appendLog('WAYPOINT', 'Sonar CHIRP', `${wp.id} ajouté (${wp.coords})`);
    showToast(`${wp.id} créé et projeté sur la carte`);
  }, [waypoints.length, telemetry.chirpDepth, appendLog, showToast]);

  const handleToggleConfigFlag = useCallback(
    (key: 'auto_pilot' | 'auto_export_nmea' | 'low_power_mode' | 'ai_transit_sleep') => {
      const nextVal = !config.mcp_agent[key];
      setConfig((prev) => ({
        ...prev,
        mcp_agent: {
          ...prev.mcp_agent,
          [key]: nextVal,
        },
      }));
      setIsConfigDirty(true);

      if (key === 'low_power_mode') {
        showToast(nextVal ? 'Mode Basse Consommation (5 FPS)' : 'Mode Performance (18 FPS)');
      } else if (key === 'ai_transit_sleep') {
        appendLog(
          'RESSOURCES',
          'Transit IA',
          nextVal
            ? 'IA désactivée pour le déplacement (GPU 8%, 0 FPS)'
            : 'IA réactivée pour détection bathymétrique'
        );
        showToast(
          nextVal
            ? 'IA en veille durant les déplacements'
            : 'IA réactivée pour la détection Poissons'
        );
      }
    },
    [config.mcp_agent, appendLog, showToast]
  );

  const handleOpenEditModal = useCallback((wp: Waypoint) => {
    setEditName(wp.name);
    setEditCategory(wp.category);
    setEditDepth(String(wp.depthM));
    setModal({ type: 'edit', wp });
  }, []);

  const handleSaveEditedWaypoint = () => {
    if (modal.type !== 'edit') return;
    const targetId = modal.wp.id;
    const parsedDepth = parseFloat(editDepth) || modal.wp.depthM;
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === targetId
          ? {
              ...w,
              name: editName.trim() || w.name,
              category: editCategory,
              rawType: editCategory,
              depthM: parsedDepth,
              metaValue1: `${parsedDepth} mètres`,
            }
          : w
      )
    );
    setIsConfigDirty(true);
    setModal({ type: 'none' });
    showToast(`${targetId} mis à jour`);
  };

  const handleDeleteWaypoint = (id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
    setIsConfigDirty(true);
    setModal({ type: 'none' });
    showToast(`${id} supprimé`);
  };

  const handleResetDemo = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TRACK_MEMOIRE_KEY);
      localStorage.removeItem(LICENSE_MEMOIRE_KEY);
      localStorage.removeItem(RAG_MEMOIRE_KEY);
    } catch {
      // ignore
    }
    const fresh = createInitialWaypoints();
    setWaypoints(fresh);
    setPointsInteret(DEFAULT_MED_POINTS_INTERET);
    setRagIndex(buildLocalRagIndex(DEFAULT_MED_POINTS_INTERET, NAVIGATION_ZONES));
    setManualLicense(EMPTY_MANUAL_LICENSE);
    setSavedPlaces([]);
    setMemoireDecisions([
      {
        id: 'MEM-01',
        note: 'Capture GPS 1-clic via navigator.geolocation (sans saisie manuelle lat/lon)',
        timestamp: 'Initialisation',
      },
    ]);
    setTrackMemoire(createInitialTrackMemoire());
    setActiveWaypointId('WP-01');
    setConfig(DEFAULT_MCP_CONFIG);
    setCacheSizeMb(142);
    setImportHistory([{ date: 'Initialisation', file: 'skikda_points.csv', count: 6 }]);
    setIsConfigDirty(false);
    setHeadingApplied(false);
    setActiveScanArea(null);
    setAutoLogCountdownSec(DEFAULT_MCP_CONFIG.MARINE_GPS_TRACKER.auto_log_interval_sec);
    setTelemetry((prev) => ({
      ...prev,
      gnssSynced: false,
      gnssOffsetM: 14.2,
      gnssAnchor: 'Non calibré (dérive Skikda)',
      memoryBufferMb: 284,
    }));
    setModal({ type: 'none' });
    showToast('Base MarineVision Méditerranée et marine_tools_config réinitialisées');
  };

  const syncScriptContent = useMemo(
    () => buildAutoSyncScript(config.gnss_nmea.nmea_port, config.gnss_nmea.baudrate),
    [config.gnss_nmea.nmea_port, config.gnss_nmea.baudrate]
  );

  const implScriptContent = useMemo(
    () =>
      modal.type === 'impl-script'
        ? buildSelectionMenuScript(modal.lang, pointsInteret)
        : '',
    [modal, pointsInteret]
  );

  return (
    <div className="min-h-screen bg-[#0d141d] text-[#dce3f0] overflow-x-hidden">
      <Header
        activeTab={activeTab}
        isAdmin={IS_ADMIN}
        onSelectTab={setActiveTab}
        onOpenProfile={() => setModal({ type: 'profile' })}
        onShareApp={() => void partagerApp(true)}
        onOpenQrShare={() => handleOpenQrShare(true)}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-28 sm:pt-24 md:pt-20 pb-24 md:pb-12">
        {activeTab === 'dashboard-bento' && (
          <BentoDashboard
            telemetry={telemetry}
            biomassThreshold={config.mcp_agent.biomass_threshold}
            lowPowerMode={config.mcp_agent.low_power_mode}
            headingApplied={headingApplied}
            gpsTracker={config.MARINE_GPS_TRACKER}
            toolsConfig={config.marine_tools_config}
            activeZone={activeZone}
            autoLogCountdownSec={autoLogCountdownSec}
            isAdmin={IS_ADMIN}
            isCapturingPosition={isCapturingPosition}
            onSaveCurrentPosition={handleStartCapturePosition}
            onShareApp={() => void partagerApp(true)}
            onOpenQrShare={() => handleOpenQrShare(true)}
            onSelectBlip={(blip) => showToast(`Cible : ${blip.name} (${blip.depth})`)}
            onRunMcpPipeline={() => handleExecuteMcpCommand('/gnss_sync')}
            onApplyHeading={() => {
              const nextCog = (telemetry.cog + 6) % 360;
              setTelemetry((prev) => ({ ...prev, cog: nextCog }));
              setHeadingApplied(true);
              appendLog('ROUTING', 'Pilote MCP', `Évitement Ras El Hadid : Cap ${nextCog}° engagé`);
              showToast(`Cap corrigé : ${nextCog}° engagé`);
            }}
            onEnableHardwareHook={() =>
              handleEnableSystemHook(
                config.MARINE_GPS_TRACKER.sensor_id,
                !config.MARINE_GPS_TRACKER.hardware_hook_active
              )
            }
            onConfigureAutoLog={() =>
              handleSetAutoLog(
                config.MARINE_GPS_TRACKER.auto_log_interval_sec,
                config.MARINE_GPS_TRACKER.target_file
              )
            }
            onExportSetupJson={handleExportSetupMarineGpsJson}
            onSelectPlan={handleSelectPlan}
            onNotify={showToast}
            onExport={handleExport}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'carte-sonar' && (
          <SonarMapView
            telemetry={telemetry}
            waypoints={waypoints}
            savedPlaces={savedPlaces}
            trackMemoire={trackMemoire}
            activeWaypointId={activeWaypointId}
            overlayMode={config.mcp_agent.process_type}
            lowPowerMode={config.mcp_agent.low_power_mode}
            aiTransitSleep={config.mcp_agent.ai_transit_sleep}
            fishVisible={fishVisible}
            scanRadiusM={config.mcp_agent.scan_radius_m}
            activeScanArea={activeScanArea}
            geofence={config.geofence}
            gnssNmea={config.gnss_nmea}
            activeZone={activeZone}
            isAdmin={IS_ADMIN}
            isCapturingPosition={isCapturingPosition}
            onSaveCurrentPosition={handleStartCapturePosition}
            onToggleFishVisible={() => {
              const next = !fishVisible;
              setFishVisible(next);
              showToast(
                next
                  ? 'Poissons IA activé (génération auto de waypoints prête)'
                  : 'Couche Poissons IA masquée'
              );
            }}
            onToggleAiTransitSleep={() => handleToggleConfigFlag('ai_transit_sleep')}
            onGnssSync={handleGnssSync}
            onSelectWaypoint={handleActivateWaypoint}
            onCreateWaypoint={handleCreateSonarWaypoint}
            onScanAreaOllama={handleScanAreaOllama}
            onNotify={showToast}
          />
        )}

        {activeTab === 'waypoints-nav' && (
          <WaypointsNavView
            waypoints={waypoints}
            savedPlaces={savedPlaces}
            activeWaypointId={activeWaypointId}
            activeZoneId={activeZone.id}
            isAdmin={IS_ADMIN}
            isCapturingPosition={isCapturingPosition}
            onChangeZone={handleChangeNavigationZone}
            onSaveCurrentPosition={handleStartCapturePosition}
            onOpenManualPoint={handleOpenManualPointModal}
            onViewOnMap={(id) => {
              setActiveWaypointId(id);
              setActiveTab('carte-sonar');
            }}
            onActivateWaypoint={handleActivateWaypoint}
            onEditWaypoint={handleOpenEditModal}
            onInspectWaypoint={(wp) => setModal({ type: 'details', wp })}
            onImportFile={handleImportFile}
            onExtractJson={handleExtractJson}
            onDownloadSampleCsv={() => {
              downloadSampleSkikdaCsv();
              appendLog('EXPORT', 'Modèle CSV', 'Fichier modèle skikda_points.csv téléchargé');
              showToast('Modèle skikda_points.csv téléchargé');
            }}
            onShowImportHistory={() => setModal({ type: 'history' })}
            onExport={handleExport}
          />
        )}

        {IS_ADMIN && activeTab === 'agent-mcp-config' && (
          <AgentMcpView
            config={syncedConfig}
            isDirty={isConfigDirty}
            telemetry={telemetry}
            trackMemoire={trackMemoire}
            logs={logs}
            cacheSizeMb={cacheSizeMb}
            autoLogCountdownSec={autoLogCountdownSec}
            manualLicense={manualLicense}
            pointsInteret={pointsInteret}
            ragIndex={ragIndex}
            isAdmin={IS_ADMIN}
            onToggleAdminMode={handleToggleAdminMode}
            onShareApp={(guest = true) => void partagerApp(guest)}
            onOpenQrShare={(guest = true) => handleOpenQrShare(guest)}
            onDownloadManifest={handleDownloadManifest}
            onExecuteCommand={handleExecuteMcpCommand}
            onExtractAndSaveJson={handleExtractJson}
            onExportXlsx={handleExportXlsx}
            onExportSetupMarineGpsJson={handleExportSetupMarineGpsJson}
            onExportMarineToolsJson={handleExportMarineToolsJson}
            onExportMedPoisJson={handleExportMedPoisJson}
            onExportLieuxNavJson={handleExportLieuxNavJson}
            onExportPdf={() => handleExport('PDF')}
            onIndexRagDatabase={handleIndexRagDatabase}
            onOpenImplScriptModal={handleOpenImplScriptModal}
            onOpenNavView={() => {
              setActiveTab('waypoints-nav');
              showToast('Onglet Lieux & Navigation affiché');
            }}
            onOpenManualPoint={handleOpenManualPointModal}
            onCapturePoiFromGnrmc={handleCapturePoiFromGnrmc}
            onTogglePoiAiAlert={handleTogglePoiAiAlert}
            onActivateLicenseCode={handleActivateLicenseCode}
            onRevokeLicense={handleRevokeLicense}
            onPurchaseTurnkey={handlePurchaseTurnkey}
            onFocusBento={() => {
              setActiveTab('dashboard-bento');
              showToast('Tableau Bento épuré affiché');
            }}
            onFocusGpsWidget={() => {
              setActiveTab('dashboard-bento');
              window.setTimeout(() => {
                document.getElementById('gps-widget-panel')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
              showToast('GPSWidget affiché sur le Tableau Bento');
            }}
            onFocusCompassGps={() => {
              setActiveTab('dashboard-bento');
              window.setTimeout(() => {
                document.getElementById('compass-gps-panel')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
              showToast('Composant Compas + GPS + AISStream affiché');
            }}
            onOpenPasserelle={() => setModal({ type: 'profile' })}
            onSaveCurrentPosition={handleStartCapturePosition}
            onOpenSyncScript={handleOpenSyncScript}
            onReloadConfig={() => {
              const fresh = loadSavedState();
              if (fresh?.config) setConfig(hydrateConfig(fresh.config));
              setIsConfigDirty(false);
              showToast('Configuration rechargée');
            }}
            onTestInference={() => {
              if (config.mcp_agent.ai_transit_sleep) {
                showToast('IA en veille de déplacement — désactivez le mode transit');
                return;
              }
              const lat = 70 + Math.floor(Math.random() * 18);
              setTelemetry((prev) => ({ ...prev, latency: lat }));
              appendLog('INFERENCE', 'llava-marine:7b', `Inférence Skikda validée en ${lat} ms`);
              showToast(`Inférence validée en ${lat} ms`);
            }}
            onToggleConfigFlag={handleToggleConfigFlag}
            onChangeBiomassThreshold={(pct) => {
              setConfig((prev) => ({
                ...prev,
                mcp_agent: {
                  ...prev.mcp_agent,
                  biomass_threshold: +(pct / 100).toFixed(2),
                },
              }));
              setIsConfigDirty(true);
            }}
            onUpdateGeofence={(patch) => {
              setConfig((prev) => ({
                ...prev,
                geofence: {
                  ...prev.geofence,
                  ...patch,
                },
              }));
              setIsConfigDirty(true);
              if (typeof patch.enabled === 'boolean') {
                appendLog(
                  'GEOFENCE',
                  config.geofence.zone_name,
                  `Geofence ${patch.enabled ? 'activé' : 'désactivé'} (${config.geofence.radius_m} m)`
                );
                showToast(
                  patch.enabled
                    ? `Geofence ${config.geofence.zone_name} activé`
                    : `Geofence ${config.geofence.zone_name} désactivé`
                );
              }
            }}
            onUpdateGnssNmea={(patch) => {
              setConfig((prev) => ({
                ...prev,
                gnss_nmea: {
                  ...prev.gnss_nmea,
                  ...patch,
                },
              }));
              setIsConfigDirty(true);
              if (patch.android_permission) {
                appendLog(
                  'ANDROID GNSS',
                  'Permissions',
                  `Autorisation position définie sur : ${patch.android_permission}`
                );
                showToast(
                  patch.android_permission === 'always'
                    ? 'Android : Toujours autoriser activé'
                    : 'Attention : autorisation Android restreinte'
                );
              } else if (typeof patch.antenna_clear_sky === 'boolean') {
                appendLog(
                  'ANTENNE GNSS',
                  'Signal RF',
                  patch.antenna_clear_sky
                    ? 'Antenne dégagée : ciel libre (précision optimale)'
                    : 'Antenne obstruée : signal GNSS dégradé'
                );
              } else if (typeof patch.record_to_memoire === 'boolean') {
                showToast(
                  patch.record_to_memoire
                    ? 'Enregistrement trajets vers visionia_memoire activé'
                    : 'Enregistrement visionia_memoire mis en pause'
                );
              }
            }}
            onUpdatePwaDeploy={(patch: Partial<PwaDeployConfig>) => {
              setConfig((prev) => ({
                ...prev,
                pwa_deploy: {
                  ...prev.pwa_deploy,
                  ...patch,
                },
              }));
              setIsConfigDirty(true);
            }}
            onSyncNetlify={handleSyncNetlify}
            onExportNetlifyToml={handleExportNetlifyToml}
            onNotify={showToast}
            onLog={appendLog}
            onSelectPlan={handleSelectPlan}
            onReviseWeeklyPrice={handleReviseWeeklyPrice}
            onToggleFeatureTier={handleToggleFeatureTier}
            onTestHasAccess={handleTestHasAccess}
            onToggleConstellation={(key) => {
              const nextVal = !config.gnss_nmea.constellations[key];
              setConfig((prev) => ({
                ...prev,
                gnss_nmea: {
                  ...prev.gnss_nmea,
                  constellations: {
                    ...prev.gnss_nmea.constellations,
                    [key]: nextVal,
                  },
                },
              }));
              setIsConfigDirty(true);
              appendLog(
                'GNSS',
                key.toUpperCase(),
                `Constellation ${key.toUpperCase()} ${nextVal ? 'activée' : 'désactivée'}`
              );
            }}
            onClearTrackMemoire={() => {
              setTrackMemoire([]);
              appendLog('MEMOIRE', 'visionia_memoire', 'Trajet local effacé');
              showToast('Mémoire locale visionia_memoire vidée');
            }}
            onPurgeCache={() => {
              setCacheSizeMb(0);
              showToast('Cache dalles Skikda vidé');
            }}
            onUpdateCache={() => {
              setCacheSizeMb(168);
              showToast('Dalles Golfe de Skikda mises à jour (168 Mo)');
            }}
            onCopyJson={() => {
              navigator.clipboard?.writeText(JSON.stringify(syncedConfig, null, 2));
              showToast('visionia_optimization.json copié');
            }}
          />
        )}
      </main>

      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 right-4 z-50 max-w-sm bg-[#19202a] border border-[#40dcca]/40 text-[#e0fdff] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-[#40dcca] shrink-0" />
          <span className="text-xs font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Universal Modal */}
      <Modal
        open={modal.type !== 'none'}
        title={
          modal.type === 'save-place'
            ? 'Enregistrer ce lieu'
            : modal.type === 'manual-point'
              ? 'Ajouter point manuel (Nom, Lat, Lon)'
              : modal.type === 'impl-script'
                ? `Script d'implémentation (${modal.lang === 'python' ? 'Python' : 'JavaScript'})`
                : modal.type === 'edit'
                  ? `Éditer ${modal.wp.id}`
                  : modal.type === 'details'
                    ? `${modal.wp.id} — Détails ${activeZone.label}`
                    : modal.type === 'history'
                      ? 'Historique Imports CSV / GPX'
                      : modal.type === 'pdf'
                        ? `Export PDF — ${activeZone.label}`
                        : modal.type === 'sync-script'
                          ? 'Script Sync Auto → donnees_visionia.xlsx'
                          : modal.type === 'qr-share'
                            ? 'Distribuer Marina Visionnaire (QR Code & PWA)'
                            : IS_ADMIN
                              ? 'Passerelle Méditerranéenne — Paramètres'
                              : 'Marina Visionnaire — Mode Invité'
        }
        onClose={() => setModal({ type: 'none' })}
        footer={
          modal.type === 'save-place' ? (
            <>
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="px-3 py-2 rounded-lg bg-[#232a34] text-[#dce3f0] text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmSavePlace}
                className="px-4 py-2 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Épingler sur la carte</span>
              </button>
            </>
          ) : modal.type === 'manual-point' ? (
            <>
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="px-3 py-2 rounded-lg bg-[#232a34] text-[#dce3f0] text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmManualPoint}
                className="px-4 py-2 rounded-lg bg-[#40dcca] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Ajouter le point</span>
              </button>
            </>
          ) : modal.type === 'edit' ? (
            <>
              <button
                type="button"
                onClick={() => handleDeleteWaypoint(modal.wp.id)}
                className="px-3 py-2 rounded-lg bg-[#93000a]/30 text-[#ffb4ab] text-xs font-semibold mr-auto"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="px-3 py-2 rounded-lg bg-[#232a34] text-[#dce3f0] text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEditedWaypoint}
                className="px-4 py-2 rounded-lg bg-[#00f2fe] text-[#002022] text-xs font-semibold"
              >
                Enregistrer
              </button>
            </>
          ) : modal.type === 'details' ? (
            <>
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="px-3 py-2 rounded-lg bg-[#232a34] text-[#dce3f0] text-xs"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveWaypointId(modal.wp.id);
                  setModal({ type: 'none' });
                  setActiveTab('carte-sonar');
                }}
                className="px-4 py-2 rounded-lg bg-[#00f2fe] text-[#002022] text-xs font-semibold"
              >
                Voir sur Carte
              </button>
            </>
          ) : modal.type === 'pdf' ? (
            <>
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="px-3 py-2 rounded-lg bg-[#232a34] text-[#dce3f0] text-xs"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  setModal({ type: 'none' });
                  window.setTimeout(() => window.print(), 100);
                }}
                className="px-4 py-2 rounded-lg bg-[#00f2fe] text-[#002022] text-xs font-semibold"
              >
                Imprimer / Enregistrer PDF
              </button>
            </>
          ) : modal.type === 'impl-script' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(implScriptContent);
                  showToast(`Script ${modal.lang === 'python' ? 'Python' : 'JS'} copié`);
                }}
                className="px-3 py-2 rounded-lg bg-[#232a34] text-[#dce3f0] text-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copier</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadImplScript(implScriptContent, modal.lang);
                  showToast(
                    `marinevision_mediterranee_menu.${modal.lang === 'python' ? 'py' : 'js'} téléchargé`
                  );
                }}
                className="px-3 py-2 rounded-lg bg-[#00f2fe] text-[#002022] text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger .{modal.lang === 'python' ? 'py' : 'js'}</span>
              </button>
            </>
          ) : modal.type === 'sync-script' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(syncScriptContent);
                  showToast('Script Python copié');
                }}
                className="px-3 py-2 rounded-lg bg-[#232a34] text-[#dce3f0] text-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copier</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadSyncScript(syncScriptContent);
                  showToast('sync_visionia_xlsx.py téléchargé');
                }}
                className="px-3 py-2 rounded-lg bg-[#19202a] border border-[#40dcca]/50 text-[#40dcca] text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger .py</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportXlsx();
                  setModal({ type: 'none' });
                }}
                className="px-4 py-2 rounded-lg bg-[#00f2fe] text-[#002022] text-xs font-semibold"
              >
                Exporter .xlsx
              </button>
            </>
          ) : modal.type === 'profile' ? (
            <>
              {IS_ADMIN && (
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="px-3 py-2 rounded-lg bg-[#93000a]/30 text-[#ffb4ab] text-xs font-semibold mr-auto"
                >
                  Réinitialiser Démo
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="px-4 py-2 rounded-lg bg-[#00f2fe] text-[#002022] text-xs font-semibold"
              >
                Fermer
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setModal({ type: 'none' })}
              className="px-4 py-2 rounded-lg bg-[#00f2fe] text-[#002022] text-xs font-semibold"
            >
              Fermer
            </button>
          )
        }
      >
        {modal.type === 'save-place' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmSavePlace();
            }}
            className="space-y-4"
          >
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#40dcca]/40 flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-[#40dcca] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#e0fdff]">
                  Position GPS capturée automatiquement
                </div>
                <div className="text-[11px] text-[#9eb2b8]">
                  Précision ±{modal.accuracyM} m · Aucune saisie de coordonnées requise
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="place-name-input" className="block text-xs font-medium text-[#e0fdff] mb-1.5">
                Nom du lieu
              </label>
              <input
                id="place-name-input"
                type="text"
                autoFocus
                value={placeNameInput}
                onChange={(e) => setPlaceNameInput(e.target.value)}
                placeholder="Ex : Banc de Stora, Mouillage Abrité..."
                className="w-full bg-[#080f18] border border-[#00f2fe]/50 rounded-lg px-3 py-2.5 text-sm text-[#e0fdff] placeholder-[#849495] focus:outline-none focus:border-[#00f2fe]"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-[#9eb2b8] mb-1.5">
                Type d&apos;épingle sur la carte
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'anchor', label: 'Mouillage / Abri' },
                    { id: 'fish', label: 'Zone de pêche' },
                    { id: 'wreck', label: 'Épave / Repère' },
                    { id: 'restricted', label: 'Danger / Écueil' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlaceCategoryInput(item.id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors ${
                      placeCategoryInput === item.id
                        ? 'bg-[#19202a] border-[#00f2fe] text-[#00f2fe]'
                        : 'bg-[#080f18] border-[#3a494b]/60 text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {modal.type === 'manual-point' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmManualPoint();
            }}
            className="space-y-4"
          >
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#40dcca]/40 text-[11px] text-[#9eb2b8] leading-relaxed">
              {MANUAL_POINT_TOOLTIP}
            </div>

            {manualError && (
              <div className="p-2.5 rounded-lg bg-[#93000a]/30 border border-[#ffb4ab]/40 text-xs text-[#ffb4ab]">
                {manualError}
              </div>
            )}

            <div>
              <label htmlFor="manual-name-input" className="block text-xs font-medium text-[#e0fdff] mb-1">
                Nom du point
              </label>
              <input
                id="manual-name-input"
                type="text"
                autoFocus
                value={manualName}
                onChange={(e) => {
                  setManualName(e.target.value);
                  setManualError(null);
                }}
                placeholder="Ex : Cap Ferrat, Mouillage Stora, Bouée Nord..."
                className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-sm text-[#e0fdff] placeholder-[#849495] focus:outline-none focus:border-[#00f2fe]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="manual-lat-input" className="block text-xs font-medium text-[#e0fdff] mb-1">
                  Latitude (° décimal)
                </label>
                <input
                  id="manual-lat-input"
                  type="text"
                  inputMode="decimal"
                  value={manualLat}
                  onChange={(e) => {
                    setManualLat(e.target.value);
                    setManualError(null);
                  }}
                  placeholder="36.9350"
                  className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-sm font-mono text-[#00f2fe] focus:outline-none focus:border-[#00f2fe]"
                />
              </div>
              <div>
                <label htmlFor="manual-lon-input" className="block text-xs font-medium text-[#e0fdff] mb-1">
                  Longitude (° décimal)
                </label>
                <input
                  id="manual-lon-input"
                  type="text"
                  inputMode="decimal"
                  value={manualLon}
                  onChange={(e) => {
                    setManualLon(e.target.value);
                    setManualError(null);
                  }}
                  placeholder="6.9550"
                  className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-sm font-mono text-[#00f2fe] focus:outline-none focus:border-[#00f2fe]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="manual-zone-select" className="block text-xs font-medium text-[#9eb2b8] mb-1">
                  Zone de navigation
                </label>
                <select
                  id="manual-zone-select"
                  value={manualZoneId}
                  onChange={(e) => {
                    const nextZoneId = e.target.value as NavigationZoneId;
                    setManualZoneId(nextZoneId);
                    const z = getNavigationZone(nextZoneId);
                    setManualLat(z.centerLat.toFixed(4));
                    setManualLon(z.centerLon.toFixed(4));
                  }}
                  className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-xs text-[#e0fdff] focus:outline-none focus:border-[#00f2fe]"
                >
                  {NAVIGATION_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="manual-depth-input" className="block text-xs font-medium text-[#9eb2b8] mb-1">
                  Profondeur estimée (m)
                </label>
                <input
                  id="manual-depth-input"
                  type="number"
                  min={1}
                  max={2000}
                  value={manualDepth}
                  onChange={(e) => setManualDepth(e.target.value)}
                  className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-xs font-mono text-[#e0fdff] focus:outline-none focus:border-[#00f2fe]"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#9eb2b8] mb-1.5">
                Type de point
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'anchor', label: 'Mouillage / Abri' },
                    { id: 'fish', label: 'Zone de pêche' },
                    { id: 'wreck', label: 'Épave / Repère' },
                    { id: 'restricted', label: 'Danger / Écueil' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setManualCategory(item.id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors ${
                      manualCategory === item.id
                        ? 'bg-[#19202a] border-[#40dcca] text-[#40dcca]'
                        : 'bg-[#080f18] border-[#3a494b]/60 text-[#9eb2b8] hover:text-[#e0fdff]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {modal.type === 'edit' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#9eb2b8] mb-1">Nom du waypoint</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-sm text-[#e0fdff]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9eb2b8] mb-1">Type</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as WaypointCategory)}
                  className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-sm text-[#e0fdff]"
                >
                  <option value="fish">fish (Banc)</option>
                  <option value="wreck">wreck (Structure)</option>
                  <option value="anchor">anchor (Mouillage)</option>
                  <option value="restricted">restricted (Danger)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#9eb2b8] mb-1">Profondeur (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editDepth}
                  onChange={(e) => setEditDepth(e.target.value)}
                  className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-3 py-2 text-sm font-mono text-[#e0fdff]"
                />
              </div>
            </div>
          </div>
        )}

        {modal.type === 'details' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#080f18] border border-[#3a494b]/50">
              <div className="text-sm font-semibold text-[#e0fdff]">{modal.wp.name}</div>
              <div className="font-mono text-[#00f2fe] mt-1">{modal.wp.coords}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded bg-[#151c25]">
                <span className="text-[#9eb2b8] block">Distance / Cap</span>
                <strong className="font-mono text-[#e0fdff]">
                  {modal.wp.distanceNm} NM · {modal.wp.bearing}°
                </strong>
              </div>
              <div className="p-2.5 rounded bg-[#151c25]">
                <span className="text-[#9eb2b8] block">Depth / Type</span>
                <strong className="font-mono text-[#40dcca]">
                  {modal.wp.depthM} m ({modal.wp.rawType})
                </strong>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#3a494b]/40 text-[#dce3f0]">
              Approche optimale au cap {modal.wp.bearing}° avec sonde à {modal.wp.depthM} m.{' '}
              {modal.wp.metaValue2}.
            </div>
          </div>
        )}

        {modal.type === 'history' && (
          <div className="space-y-2">
            {importHistory.map((item, idx) => (
              <div
                key={`${item.file}-${idx}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#151c25] text-xs"
              >
                <div>
                  <div className="font-medium text-[#e0fdff]">{item.file}</div>
                  <div className="text-[#9eb2b8]">{item.date}</div>
                </div>
                <span className="font-mono text-[#40dcca]">{item.count} pts</span>
              </div>
            ))}
          </div>
        )}

        {modal.type === 'pdf' && (
          <div className="space-y-2.5 text-xs text-[#9eb2b8]">
            <p>
              Rapport consolidé prêt pour impression ou archivage PDF ({waypoints.length} waypoints ·{' '}
              {pointsInteret.length} POI · {activeZone.label}).
            </p>
            <div className="p-3 rounded-lg bg-[#080f18] border border-[#3a494b]/50 space-y-1.5">
              <div className="font-semibold text-[#e0fdff]">
                MarineVision AI · Méditerranée — {activeZone.label}
              </div>
              <div className="font-mono text-[11px] text-[#dce3f0]">
                Contact : {PROJECT_CONTACT.phone} · {PROJECT_CONTACT.email}
              </div>
              <div className="font-mono text-[11px] text-[#ffba38]">
                Offres : 1 mois (20 €) · 3 mois (50 €) · 1 an (100 €)
              </div>
              <div className="font-mono text-[#40dcca]">
                SOG {telemetry.sog.toFixed(1)} kts · COG {String(telemetry.cog).padStart(3, '0')}° ·
                Sonde {telemetry.chirpDepth.toFixed(1)} m
              </div>
            </div>
          </div>
        )}

        {modal.type === 'impl-script' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[#9eb2b8]">
                Script prêt à intégrer pour le menu de sélection Méditerranée et le calcul Haversine.
              </p>
              <div className="flex items-center gap-1 bg-[#080f18] p-0.5 rounded-lg border border-[#3a494b]/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setModal({ type: 'impl-script', lang: 'javascript' })}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                    modal.lang === 'javascript'
                      ? 'bg-[#00f2fe] text-[#002022] font-bold'
                      : 'text-[#9eb2b8]'
                  }`}
                >
                  JavaScript
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'impl-script', lang: 'python' })}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                    modal.lang === 'python'
                      ? 'bg-[#40dcca] text-[#002022] font-bold'
                      : 'text-[#9eb2b8]'
                  }`}
                >
                  Python
                </button>
              </div>
            </div>
            <pre className="bg-[#080f18] border border-[#3a494b]/60 rounded-lg p-3 font-mono text-[11px] text-[#dce3f0] overflow-x-auto max-h-72 select-all">
              {implScriptContent}
            </pre>
          </div>
        )}

        {modal.type === 'sync-script' && (
          <div className="space-y-3 text-xs">
            <p className="text-[#9eb2b8]">
              Script généré pour synchroniser les trajets{' '}
              <code className="text-[#00f2fe]">visionia_memoire</code> ({trackMemoire.length} pts)
              et les waypoints vers <code className="text-[#40dcca]">donnees_visionia.xlsx</code>.
            </p>
            <pre className="bg-[#080f18] border border-[#3a494b]/60 rounded-lg p-3 font-mono text-[11px] text-[#dce3f0] overflow-x-auto max-h-60 select-all">
              {syncScriptContent}
            </pre>
          </div>
        )}

        {modal.type === 'qr-share' && (
          <QrShareBody
            guestMode={modal.guestMode}
            onChangeGuestMode={(guest) => setModal({ type: 'qr-share', guestMode: guest })}
            onShareNative={(guest) => void partagerApp(guest)}
            onNotify={showToast}
          />
        )}

        {modal.type === 'profile' && (
          <div className="space-y-3 text-xs">
            {/* IS_ADMIN / Mode Invité Role Switcher */}
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#40dcca]/45 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {IS_ADMIN ? (
                  <Shield className="w-4 h-4 text-[#00f2fe] shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-[#40dcca] shrink-0" />
                )}
                <div>
                  <div className="font-semibold text-[#e0fdff]">
                    {IS_ADMIN ? 'Mode Admin (IS_ADMIN = true)' : 'Mode Invité Client (IS_ADMIN = false)'}
                  </div>
                  <div className="text-[11px] text-[#9eb2b8]">
                    {IS_ADMIN
                      ? 'Consoles MCP, imports/éditions et réglages avancés visibles'
                      : 'Interface client épurée : consoles et outils d’édition masqués'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleAdminMode(!IS_ADMIN)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  IS_ADMIN
                    ? 'bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/60 text-[#40dcca]'
                    : 'bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022]'
                }`}
              >
                {IS_ADMIN ? 'Basculer en Mode Invité' : 'Activer Mode Admin'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void partagerApp(true)}
                className="py-2.5 px-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/45 text-[#00f2fe] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager (navigator.share)</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenQrShare(true)}
                className="py-2.5 px-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/45 text-[#40dcca] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                <span>QR Code de distribution</span>
              </button>
            </div>

            {IS_ADMIN && (
              <button
                type="button"
                onClick={() => {
                  setModal({ type: 'none' });
                  setActiveTab('agent-mcp-config');
                }}
                className="w-full py-3 px-4 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-[#00f2fe]/15 transition-colors"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>Ouvrir Cockpit Complet Agent MCP &amp; Paramètres</span>
              </button>
            )}

            {/* 1. Navigation & Base Méditerranée */}
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#3a494b]/50 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wide text-[#00f2fe]">
                Navigation &amp; Base Méditerranée
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2 rounded bg-[#080f18]">
                  <div className="text-[10px] text-[#9eb2b8]">Zone active</div>
                  <div className="font-semibold text-[#e0fdff]">{activeZone.label}</div>
                </div>
                <div className="p-2 rounded bg-[#080f18]">
                  <div className="text-[10px] text-[#9eb2b8]">Base Unifiée &amp; RAG</div>
                  <div className="font-mono text-[#40dcca]">
                    {pointsInteret.length} POI · {ragIndex.total_docs} docs RAG
                  </div>
                </div>
                <div className="p-2 rounded bg-[#080f18]">
                  <div className="text-[10px] text-[#9eb2b8]">Capteur GPS Tracker</div>
                  <div className="font-mono text-[#00f2fe]">
                    {config.MARINE_GPS_TRACKER.sensor_id} · {config.MARINE_GPS_TRACKER.sampling_rate}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#080f18]">
                  <div className="text-[10px] text-[#9eb2b8]">Trajets &amp; Auto-Log Excel</div>
                  <div className="font-mono text-[#e0fdff]">
                    {trackMemoire.length} pts ·{' '}
                    {config.MARINE_GPS_TRACKER.auto_log_excel
                      ? `${config.MARINE_GPS_TRACKER.auto_log_interval_sec}s`
                      : 'Manuel'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Paramètres Agent IA & Télémétrie (Admin only) */}
            {IS_ADMIN && (
              <>
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#3a494b]/50 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wide text-[#40dcca]">
                Agent IA, Ollama &amp; Ressources
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleConfigFlag('auto_pilot')}
                  className="p-2 rounded bg-[#080f18] border border-[#3a494b]/40 flex items-center justify-between gap-1 text-left"
                >
                  <span className="text-[#dce3f0] font-mono text-[11px]">auto_pilot</span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      config.mcp_agent.auto_pilot ? 'text-[#40dcca]' : 'text-[#ffb4ab]'
                    }`}
                  >
                    {config.mcp_agent.auto_pilot ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleConfigFlag('auto_export_nmea')}
                  className="p-2 rounded bg-[#080f18] border border-[#3a494b]/40 flex items-center justify-between gap-1 text-left"
                >
                  <span className="text-[#dce3f0] font-mono text-[11px]">export_nmea</span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      config.mcp_agent.auto_export_nmea ? 'text-[#40dcca]' : 'text-[#ffb4ab]'
                    }`}
                  >
                    {config.mcp_agent.auto_export_nmea ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleConfigFlag('ai_transit_sleep')}
                  className="p-2 rounded bg-[#080f18] border border-[#3a494b]/40 flex items-center justify-between gap-1 text-left"
                >
                  <span className="text-[#dce3f0] text-[11px]">Veille transit IA</span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      config.mcp_agent.ai_transit_sleep ? 'text-[#ffba38]' : 'text-[#40dcca]'
                    }`}
                  >
                    {config.mcp_agent.ai_transit_sleep ? 'VEILLE' : 'ACTIF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleConfigFlag('low_power_mode')}
                  className="p-2 rounded bg-[#080f18] border border-[#3a494b]/40 flex items-center justify-between gap-1 text-left"
                >
                  <span className="text-[#dce3f0] text-[11px]">Basse conso 5 FPS</span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      config.mcp_agent.low_power_mode ? 'text-[#40dcca]' : 'text-[#9eb2b8]'
                    }`}
                  >
                    {config.mcp_agent.low_power_mode ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px]">
                <div className="p-2 rounded bg-[#080f18]">
                  <div className="text-[10px] text-[#9eb2b8]">Seuil biomasse</div>
                  <div className="font-mono font-semibold text-[#40dcca]">
                    {Math.round(config.mcp_agent.biomass_threshold * 100)}%
                  </div>
                </div>
                <div className="p-2 rounded bg-[#080f18]">
                  <div className="text-[10px] text-[#9eb2b8]">Scan Ollama</div>
                  <div className="font-mono font-semibold text-[#00f2fe]">
                    {config.mcp_agent.scan_radius_m} m
                  </div>
                </div>
                <div className="p-2 rounded bg-[#080f18]">
                  <div className="text-[10px] text-[#9eb2b8]">Couche Sonar</div>
                  <div className="font-mono font-semibold text-[#e0fdff] capitalize">
                    {config.mcp_agent.process_type}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. GNSS, NMEA 0183 & Geofence */}
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#3a494b]/50 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wide text-[#ffba38]">
                GNSS · NMEA 0183 · Geofence
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Port Série NMEA :</span>
                  <span className="font-mono text-[#00f2fe]">
                    {config.gnss_nmea.nmea_port} · {config.gnss_nmea.baudrate} baud ·{' '}
                    {config.gnss_nmea.nmea_connected ? 'Connecté' : 'Hors ligne'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Constellations :</span>
                  <span className="font-mono text-[#40dcca]">
                    {[
                      config.gnss_nmea.constellations.gps && 'GPS',
                      config.gnss_nmea.constellations.glonass && 'GLONASS',
                      config.gnss_nmea.constellations.galileo && 'Galileo',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Aucune'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Position Android &amp; Antenne :</span>
                  <span className="font-mono text-[#e0fdff]">
                    {config.gnss_nmea.android_permission === 'always'
                      ? 'Toujours autoriser'
                      : config.gnss_nmea.android_permission === 'while_using'
                        ? 'Si active'
                        : 'Refusée'}{' '}
                    · {config.gnss_nmea.antenna_clear_sky ? 'Ciel libre' : 'Obstruée'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">
                    Geofence ({config.geofence.zone_name}) :
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        geofence: { ...prev.geofence, enabled: !prev.geofence.enabled },
                      }))
                    }
                    className={`font-mono font-semibold ${
                      config.geofence.enabled ? 'text-[#ffb4ab]' : 'text-[#9eb2b8]'
                    }`}
                  >
                    {config.geofence.enabled ? `ACTIF (${config.geofence.radius_m} m)` : 'INACTIF'}
                  </button>
                </div>
              </div>
            </div>
              </>
            )}

            {/* 4. Abonnement, Cache & PWA */}
            <div className="p-3 rounded-lg bg-[#151c25] border border-[#3a494b]/50 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wide text-[#9eb2b8]">
                Abonnement · Cache · PWA
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Abonnement &amp; AISStream :</span>
                  <span className="font-mono text-[#00f2fe]">
                    {getTierLabel(config.marine_tools_config.active_plan)} ·{' '}
                    <span
                      className={
                        hasAccess('ais_stream', config.marine_tools_config)
                          ? 'text-[#40dcca]'
                          : 'text-[#ffba38]'
                      }
                    >
                      {hasAccess('ais_stream', config.marine_tools_config)
                        ? 'AIS Déverrouillé'
                        : 'AIS Verrouillé'}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Licence &amp; Cache dalles :</span>
                  <span className="font-mono text-[#e0fdff]">
                    {manualLicense.status === 'active' ? manualLicense.code : 'Standard'} ·{' '}
                    {cacheSizeMb} Mo · Tampon {telemetry.memoryBufferMb} Mo
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Offres Validées :</span>
                  <span className="font-mono text-[#ffba38]">
                    1 mois (20 €) · 3 mois (50 €) · 1 an (100 €)
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Contact MarineVision AI :</span>
                  <span className="font-mono text-[#e0fdff] break-all">
                    {PROJECT_CONTACT.phone} · {PROJECT_CONTACT.email}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#080f18]">
                  <span className="text-[#9eb2b8]">Mode hors-ligne PWA :</span>
                  <span className="font-mono text-[#40dcca] break-all">
                    {config.pwa_deploy.sw_strategy} · {config.pwa_deploy.netlify_site}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden Print Report Area for PDF Export */}
      <div id="print-report-area" className="hidden">
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            MarineVision AI · Méditerranée — Rapport Structure &amp; Mission {activeZone.label}
          </h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            {new Date().toLocaleString('fr-FR')} · {activeZone.subtitle}
          </p>
          <p style={{ fontSize: 11, color: '#0f172a', marginTop: 6 }}>
            Contact : {PROJECT_CONTACT.phone} · {PROJECT_CONTACT.email} | Tarifs : 1 mois (20 €) ·
            3 mois (50 €) · 1 an (100 €)
          </p>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
              marginTop: 16,
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #0d141d' }}>
                <th style={{ padding: '6px 4px' }}>ID</th>
                <th style={{ padding: '6px 4px' }}>Nom</th>
                <th style={{ padding: '6px 4px' }}>Lat / Long</th>
                <th style={{ padding: '6px 4px' }}>Depth</th>
                <th style={{ padding: '6px 4px' }}>Type</th>
                <th style={{ padding: '6px 4px' }}>Route</th>
              </tr>
            </thead>
            <tbody>
              {waypoints.map((w) => (
                <tr key={w.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ padding: '6px 4px', fontWeight: 700 }}>{w.id}</td>
                  <td style={{ padding: '6px 4px' }}>{w.name}</td>
                  <td style={{ padding: '6px 4px' }}>
                    {w.lat}, {w.lon}
                  </td>
                  <td style={{ padding: '6px 4px' }}>{w.depthM} m</td>
                  <td style={{ padding: '6px 4px' }}>{w.rawType || w.category}</td>
                  <td style={{ padding: '6px 4px' }}>
                    {w.distanceNm} NM / {w.bearing}°
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
