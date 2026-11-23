import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download } from 'lucide-react';
import { AgentMcpView } from './components/AgentMcpView';
import { BentoDashboard } from './components/BentoDashboard';
import { Header } from './components/Header';
import { Modal } from './components/Modal';
import { ActiveScanArea, SonarMapView } from './components/SonarMapView';
import { WaypointsNavView } from './components/WaypointsNavView';
import {
  ImportHistoryEntry,
  MarineFeatureKey,
  McpConfig,
  McpLogEntry,
  NmeaBaudRate,
  SubscriptionTier,
  TabId,
  TelemetryState,
  TrackPoint,
  Waypoint,
  WaypointCategory,
} from './types/marine';
import {
  DEFAULT_MARINE_TOOLS_CONFIG,
  getTierLabel,
  hasAccess,
} from './utils/accessControl';
import {
  downloadSampleSkikdaCsv,
  downloadSyncScript,
  exportMarineToolsConfigJson,
  exportOptimizationJson,
  exportSetupMarineGpsJson,
  exportWaypointsXlsx,
} from './utils/exporters';
import {
  buildAutoSyncScript,
  buildNmeaSentence,
  buildWaypointFromCsvRow,
  createInitialTrackMemoire,
  createInitialWaypoints,
  DEFAULT_MCP_CONFIG,
  parseGpxText,
  parseSkikdaCsvText,
  SAMPLE_SKIKDA_CSV,
  VESSEL_LAT,
  VESSEL_LON,
} from './utils/navigation';

const STORAGE_KEY = 'marinevision_skikda_v2';
const TRACK_MEMOIRE_KEY = 'visionia_memoire';

interface SavedPersistedState {
  config: McpConfig;
  waypoints: Waypoint[];
  activeWaypointId: string;
  cacheSizeMb: number;
  importHistory: ImportHistoryEntry[];
}

function hydrateConfig(raw?: Partial<McpConfig> | null): McpConfig {
  return {
    ...DEFAULT_MCP_CONFIG,
    ...(raw || {}),
    marine_tools_config: {
      ...DEFAULT_MARINE_TOOLS_CONFIG,
      ...(raw?.marine_tools_config || {}),
      plans: raw?.marine_tools_config?.plans?.length
        ? raw.marine_tools_config.plans
        : DEFAULT_MARINE_TOOLS_CONFIG.plans,
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

type ActiveModal =
  | { type: 'none' }
  | { type: 'edit'; wp: Waypoint }
  | { type: 'details'; wp: Waypoint }
  | { type: 'history' }
  | { type: 'pdf' }
  | { type: 'profile' }
  | { type: 'sync-script' };

export default function App() {
  const initialSaved = useMemo(() => loadSavedState(), []);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard-bento');
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() =>
    initialSaved?.waypoints?.length ? initialSaved.waypoints : createInitialWaypoints()
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

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<WaypointCategory>('fish');
  const [editDepth, setEditDepth] = useState('28');

  const syncedConfig = useMemo<McpConfig>(
    () => ({
      ...config,
      points_navigation: waypoints.map((w) => ({
        id: w.id,
        name: w.name,
        lat: w.lat,
        long: w.lon,
        depth: w.depthM,
        type: w.rawType || w.category,
      })),
    }),
    [config, waypoints]
  );

  // Persist app state and visionia_memoire to localStorage
  useEffect(() => {
    try {
      const payload: SavedPersistedState = {
        config: syncedConfig,
        waypoints,
        activeWaypointId,
        cacheSizeMb,
        importHistory,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [syncedConfig, waypoints, activeWaypointId, cacheSizeMb, importHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(TRACK_MEMOIRE_KEY, JSON.stringify(trackMemoire));
    } catch {
      // Ignore storage quota errors
    }
  }, [trackMemoire]);

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
        return [...prev.slice(-119), pt];
      });
    }, 10000);
    return () => window.clearInterval(id);
  }, [
    config.gnss_nmea.record_to_memoire,
    config.gnss_nmea.android_permission,
    config.gnss_nmea.protocol_mode,
    config.gnss_nmea.baudrate,
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
    exportWaypointsXlsx(waypoints, trackMemoire);
    appendLog(
      'EXPORT',
      'Excel',
      `donnees_visionia.xlsx généré (${waypoints.length} waypoints + ${trackMemoire.length} pts visionia_memoire)`
    );
    showToast('Export Excel : donnees_visionia.xlsx téléchargé');
  }, [waypoints, trackMemoire, appendLog, showToast]);

  const handleExport = useCallback(
    (fmt: 'PDF' | 'XLSX' | 'JSON') => {
      if (fmt === 'JSON') {
        handleExtractJson();
      } else if (fmt === 'XLSX') {
        handleExportXlsx();
      } else {
        setModal({ type: 'pdf' });
        appendLog('EXPORT', 'Rapport SHOM', 'Aperçu rapport PDF Golfe de Skikda préparé');
      }
    },
    [handleExtractJson, handleExportXlsx, appendLog]
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

  const handleExecuteMcpCommand = useCallback(
    (rawCmd: string) => {
      const cmd = String(rawCmd || '').trim();
      if (!cmd) return;

      if (cmd.startsWith('/set_plan')) {
        const tierMatch = cmd.match(/--tier\s+["']?([a-z_]+)["']?/i);
        const rawTier = (tierMatch?.[1] || 'yearly').toLowerCase();
        const validTier: SubscriptionTier =
          rawTier === 'free' || rawTier === 'one_time' || rawTier === 'yearly' || rawTier === 'weekly'
            ? rawTier
            : 'yearly';
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

      if (cmd.startsWith('/export_xlsx')) {
        handleExportXlsx();
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
        'Commande non reconnue. Essayez /check_access, /set_plan, /system_hook ou /gnss_sync'
      );
    },
    [
      config.marine_tools_config.features,
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
      appendLog,
      showToast,
    ]
  );

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
    } catch {
      // ignore
    }
    const fresh = createInitialWaypoints();
    setWaypoints(fresh);
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
    showToast('Données Golfe de Skikda et marine_tools_config réinitialisées');
  };

  const syncScriptContent = useMemo(
    () => buildAutoSyncScript(config.gnss_nmea.nmea_port, config.gnss_nmea.baudrate),
    [config.gnss_nmea.nmea_port, config.gnss_nmea.baudrate]
  );

  return (
    <div className="min-h-screen bg-[#0d141d] text-[#dce3f0]">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenProfile={() => setModal({ type: 'profile' })}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 md:pb-12">
        {activeTab === 'dashboard-bento' && (
          <BentoDashboard
            telemetry={telemetry}
            biomassThreshold={config.mcp_agent.biomass_threshold}
            lowPowerMode={config.mcp_agent.low_power_mode}
            headingApplied={headingApplied}
            gpsTracker={config.MARINE_GPS_TRACKER}
            toolsConfig={config.marine_tools_config}
            autoLogCountdownSec={autoLogCountdownSec}
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
            activeWaypointId={activeWaypointId}
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

        {activeTab === 'agent-mcp-config' && (
          <AgentMcpView
            config={syncedConfig}
            isDirty={isConfigDirty}
            telemetry={telemetry}
            trackMemoire={trackMemoire}
            logs={logs}
            cacheSizeMb={cacheSizeMb}
            autoLogCountdownSec={autoLogCountdownSec}
            onExecuteCommand={handleExecuteMcpCommand}
            onExtractAndSaveJson={handleExtractJson}
            onExportXlsx={handleExportXlsx}
            onExportSetupMarineGpsJson={handleExportSetupMarineGpsJson}
            onExportMarineToolsJson={handleExportMarineToolsJson}
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
              showToast('Composant Compas + GPS affiché sur le Tableau Bento');
            }}
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
          modal.type === 'edit'
            ? `Éditer ${modal.wp.id}`
            : modal.type === 'details'
              ? `${modal.wp.id} — Détails Golfe de Skikda`
              : modal.type === 'history'
                ? 'Historique Imports CSV / GPX'
                : modal.type === 'pdf'
                  ? 'Export PDF — Golfe de Skikda'
                  : modal.type === 'sync-script'
                    ? 'Script Sync Auto → donnees_visionia.xlsx'
                    : 'Passerelle · Golfe de Skikda'
        }
        onClose={() => setModal({ type: 'none' })}
        footer={
          modal.type === 'edit' ? (
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
              <button
                type="button"
                onClick={handleResetDemo}
                className="px-3 py-2 rounded-lg bg-[#93000a]/30 text-[#ffb4ab] text-xs font-semibold mr-auto"
              >
                Réinitialiser Skikda
              </button>
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
          <div className="space-y-2 text-xs text-[#9eb2b8]">
            <p>
              Rapport consolidé prêt pour impression ou sauvegarde PDF ({waypoints.length} points
              entre Stora et Cap de Fer).
            </p>
            <div className="p-3 rounded-lg bg-[#080f18] border border-[#3a494b]/50 space-y-1">
              <div className="font-semibold text-[#e0fdff]">MarineVision AI — Golfe de Skikda</div>
              <div className="font-mono text-[#40dcca]">
                SOG {telemetry.sog.toFixed(1)} kts · COG {String(telemetry.cog).padStart(3, '0')}° ·
                Sonde {telemetry.chirpDepth.toFixed(1)} m
              </div>
            </div>
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

        {modal.type === 'profile' && (
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-[#151c25]">
              <span className="text-[#9eb2b8]">Abonnement actif : </span>
              <span className="font-semibold text-[#00f2fe]">
                {getTierLabel(config.marine_tools_config.active_plan)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#151c25]">
              <span className="text-[#9eb2b8]">AISStream (`hasAccess`) : </span>
              <span
                className={`font-mono ${
                  hasAccess('ais_stream', config.marine_tools_config)
                    ? 'text-[#40dcca]'
                    : 'text-[#ffba38]'
                }`}
              >
                {hasAccess('ais_stream', config.marine_tools_config) ? 'Déverrouillé' : 'Verrouillé (Gratuit)'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#151c25]">
              <span className="text-[#9eb2b8]">Module Tracker : </span>
              <span className="font-mono text-[#00f2fe]">
                {config.MARINE_GPS_TRACKER.sensor_id} ({config.MARINE_GPS_TRACKER.sampling_rate} ·{' '}
                {config.MARINE_GPS_TRACKER.buffer_size} pts)
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#151c25]">
              <span className="text-[#9eb2b8]">Mémoire trajets : </span>
              <span className="font-mono text-[#40dcca]">
                visionia_memoire ({trackMemoire.length} points)
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden Print Report Area for PDF Export */}
      <div id="print-report-area" className="hidden">
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            MarineVision AI — Mission Golfe de Skikda
          </h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            {new Date().toLocaleString('fr-FR')} · Stora — Port de Skikda — Cap de Fer
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
