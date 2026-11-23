import { McpConfig, NmeaBaudRate, TrackPoint, Waypoint, WaypointCategory } from '../types/marine';
import { DEFAULT_MARINE_TOOLS_CONFIG } from './accessControl';

export const VESSEL_LAT = 36.935;
export const VESSEL_LON = 6.955;

export const SAMPLE_SKIKDA_CSV = [
  'name,lat,long,depth,type',
  'Rade de Stora - Banc Pelagique,36.9045,6.8860,28,fish',
  'Passe Ile Srigina,36.9012,6.8795,18,anchor',
  'Cap de Fer - Tombant Nord,37.0815,7.1720,46,wreck',
  'Haut-Fond Ras El Hadid,37.0680,7.1450,8.2,restricted',
  'Fosse Golfe de Skikda,36.9850,7.0150,42,fish',
  'Mouillage Anse des Platanes,36.9210,6.8620,11,anchor',
].join('\n');

export const DEFAULT_MCP_CONFIG: McpConfig = {
  region: 'Golfe de Skikda (Stora - Cap de Fer)',
  marine_tools_config: DEFAULT_MARINE_TOOLS_CONFIG,
  MARINE_GPS_TRACKER: {
    enabled: true,
    sensor_id: 'GNSS_L5',
    hardware_hook_active: false,
    sampling_rate: '1Hz',
    frequency_hz: 1,
    buffer_size: 25,
    auto_log_excel: false,
    auto_log_interval_sec: 60,
    target_file: 'donnees_visionia.xlsx',
    bathymetry_depth_offset_m: 1.4,
    bathymetry_isobaths_m: [10, 20, 40, 50],
  },
  mcp_agent: {
    auto_pilot: true,
    biomass_threshold: 0.82,
    min_cluster_size: 15,
    sonar_beam_angle: 120,
    scan_radius_m: 500,
    auto_export_nmea: true,
    export_interval_sec: 5,
    low_power_mode: false,
    ai_transit_sleep: false,
    process_type: 'map_overlay',
    mode: 'auto_detect',
  },
  geofence: {
    enabled: false,
    zone_name: 'Cap de Fer · Ras El Hadid',
    lat: 37.075,
    lon: 7.16,
    radius_m: 800,
    alert_on_entry: true,
  },
  gnss_nmea: {
    android_permission: 'always',
    antenna_clear_sky: true,
    update_interval_ms: 1000,
    nmea_connected: true,
    nmea_port: '/dev/ttyUSB0',
    baudrate: 4800,
    protocol_mode: 'NMEA 0183',
    constellations: {
      gps: true,
      glonass: true,
      galileo: true,
    },
    record_to_memoire: true,
    auto_sync_xlsx: false,
  },
  points_navigation: [],
};

export function createInitialTrackMemoire(): TrackPoint[] {
  return [
    {
      id: 'TRK-01',
      timestamp: '09:30:00',
      lat: 36.9065,
      lon: 6.892,
      sog: 10.4,
      cog: 64,
      depth: 26.2,
      protocol: 'NMEA 0183 (4800 baud)',
    },
    {
      id: 'TRK-02',
      timestamp: '09:35:00',
      lat: 36.921,
      lon: 6.924,
      sog: 11.2,
      cog: 66,
      depth: 33.8,
      protocol: 'NMEA 0183 (4800 baud)',
    },
    {
      id: 'TRK-03',
      timestamp: '09:40:00',
      lat: VESSEL_LAT,
      lon: VESSEL_LON,
      sog: 11.8,
      cog: 68,
      depth: 38.6,
      protocol: 'NMEA 0183 (4800 baud)',
    },
  ];
}

export function buildNmeaSentence(
  lat: number,
  lon: number,
  sog: number,
  cog: number,
  baudrate: NmeaBaudRate
): string {
  const now = new Date();
  const hhmmss =
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0');
  const latDeg = Math.floor(Math.abs(lat));
  const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(3).padStart(6, '0');
  const lonDeg = String(Math.floor(Math.abs(lon))).padStart(3, '0');
  const lonMin = ((Math.abs(lon) - Math.floor(Math.abs(lon))) * 60).toFixed(3).padStart(6, '0');
  const gnr = `$GNRMC,${hhmmss}.00,A,${latDeg}${latMin},N,${lonDeg}${lonMin},E,${sog.toFixed(1)},${cog.toFixed(1)},211126,,,A*6C`;
  if (baudrate === 38400) {
    return `!AIVDM,1,1,,B,15M67FC000G?ufbE\`FepT@3n00Sa,0*5C · ${gnr}`;
  }
  return gnr;
}

export function buildAutoSyncScript(port: string, baudrate: NmeaBaudRate): string {
  return `#!/usr/bin/env python3
# MarineVision AI — Script de synchronisation automatique GNSS/NMEA -> donnees_visionia.xlsx
import json, time
from pathlib import Path

NMEA_PORT = "${port}"
BAUDRATE = ${baudrate}  # 4800 (NMEA 0183) ou 38400 (AIS)
MEMOIRE_STORE = "visionia_memoire"
TARGET_XLSX = Path("donnees_visionia.xlsx")

def sync_visionia_memoire():
    print(f"[MarineVision AI] Lecture {NMEA_PORT} @ {BAUDRATE} baud (GPS/GLONASS/Galileo)")
    print(f"[MarineVision AI] Synchronisation '{MEMOIRE_STORE}' -> {TARGET_XLSX}")

if __name__ == "__main__":
    while True:
        sync_visionia_memoire()
        time.sleep(60)
`;
}

export function getCardinal(deg: number): string {
  const dirs = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

export function computeNavVector(lat: number, lon: number): { distNm: number; bearing: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R_NM = 3440.065;
  const dLat = toRad(lat - VESSEL_LAT);
  const dLon = toRad(lon - VESSEL_LON);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(VESSEL_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
  const distNm = 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)));
  const y = Math.sin(dLon) * Math.cos(toRad(lat));
  const x =
    Math.cos(toRad(VESSEL_LAT)) * Math.sin(toRad(lat)) -
    Math.sin(toRad(VESSEL_LAT)) * Math.cos(toRad(lat)) * Math.cos(dLon);
  const bearing = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  return { distNm: +distNm.toFixed(1), bearing };
}

export function normalizeCsvType(rawType: string): WaypointCategory {
  const t = String(rawType || '').trim().toLowerCase();
  if (/fish|poisson|banc|pelag|peche/.test(t)) return 'fish';
  if (/wreck|epave|struct|tombant|recif/.test(t)) return 'wreck';
  if (/anchor|mouillage|abri|passe|port/.test(t)) return 'anchor';
  if (/restrict|danger|haut|interdit|zone/.test(t)) return 'restricted';
  return 'fish';
}

export interface CsvWaypointInput {
  name: string;
  lat: number;
  lon: number;
  depth: number;
  type: string;
  sourceFile?: string;
}

export function buildWaypointFromCsvRow(input: CsvWaypointInput, idx: number): Waypoint {
  const cat = normalizeCsvType(input.type);
  const vec = computeNavVector(input.lat, input.lon);
  const id = `WP-${String(idx).padStart(2, '0')}`;

  const metadataMap: Record<
    WaypointCategory,
    { badge: string; l1: string; l2: string; v2: string; ai: boolean }
  > = {
    fish: {
      badge: 'Banc IA',
      l1: 'Profondeur Sonar',
      l2: 'Détection Biologique',
      v2: 'Biomasse Détectée',
      ai: true,
    },
    wreck: {
      badge: 'Structure',
      l1: 'Profondeur Quille',
      l2: 'Nature Fond',
      v2: 'Relief / Structure',
      ai: false,
    },
    anchor: {
      badge: 'Mouillage',
      l1: 'Sonde Mouillage',
      l2: 'Statut Abri',
      v2: 'Zone Abritée',
      ai: false,
    },
    restricted: {
      badge: 'Réglementée',
      l1: 'Sonde Critique',
      l2: 'Alerte Sécurité',
      v2: 'Haut-Fond / Restriction',
      ai: false,
    },
  };

  const labels = metadataMap[cat];

  return {
    id,
    name: input.name || `Point Skikda ${idx}`,
    lat: input.lat,
    lon: input.lon,
    category: cat,
    rawType: input.type || cat,
    badge: labels.badge,
    distanceNm: vec.distNm,
    bearing: vec.bearing,
    depthM: input.depth,
    metaLabel1: labels.l1,
    metaValue1: `${input.depth} mètres`,
    metaLabel2: labels.l2,
    metaValue2: labels.v2,
    timestamp: `Source : ${input.sourceFile || 'skikda_points.csv'}`,
    coords: `${input.lat.toFixed(4)}° N / ${input.lon.toFixed(4)}° E`,
    aiDetected: labels.ai,
    confidence: cat === 'fish' ? 94 : 98,
  };
}

export function parseSkikdaCsvText(csvText: string, sourceFile = 'skikda_points.csv'): CsvWaypointInput[] {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const firstCols = lines[0].toLowerCase().split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
  const hasHeader = firstCols.includes('name') || firstCols.includes('lat') || firstCols.includes('nom');

  const colIdx = {
    name: hasHeader ? Math.max(0, firstCols.findIndex((c) => c === 'name' || c === 'nom')) : 0,
    lat: hasHeader ? Math.max(1, firstCols.indexOf('lat')) : 1,
    long: hasHeader
      ? firstCols.indexOf('long') >= 0
        ? firstCols.indexOf('long')
        : Math.max(2, firstCols.indexOf('lon'))
      : 2,
    depth: hasHeader ? Math.max(3, firstCols.findIndex((c) => c === 'depth' || c === 'profondeur')) : 3,
    type: hasHeader ? Math.max(4, firstCols.indexOf('type')) : 4,
  };

  const rows: CsvWaypointInput[] = [];
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;
    const lat = parseFloat(cols[colIdx.lat]);
    const lon = parseFloat(cols[colIdx.long]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const depth = parseFloat(cols[colIdx.depth]) || 20;
    const name = cols[colIdx.name] || `Point ${i}`;
    const type = cols[colIdx.type] || 'fish';
    rows.push({ name, lat, lon, depth, type, sourceFile });
  }
  return rows;
}

export function parseGpxText(gpxText: string, sourceFile: string): CsvWaypointInput[] {
  const doc = new DOMParser().parseFromString(gpxText, 'application/xml');
  const nodes = Array.from(doc.querySelectorAll('wpt'));
  return nodes
    .map((node, i): CsvWaypointInput | null => {
      const lat = parseFloat(node.getAttribute('lat') || '');
      const lon = parseFloat(node.getAttribute('lon') || '');
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
      const name = node.querySelector('name')?.textContent?.trim() || `GPX-${i + 1}`;
      const ele = parseFloat(node.querySelector('ele')?.textContent || '24');
      return {
        name,
        lat,
        lon,
        depth: Number.isNaN(ele) ? 24 : Math.abs(ele),
        type: 'anchor',
        sourceFile,
      };
    })
    .filter((item): item is CsvWaypointInput => item !== null);
}

export function projectLatLonToSvg(lat: number, lon: number): { x: number; y: number } {
  // Emprise Golfe de Skikda : Lon 6.82 -> 7.22 | Lat 36.84 -> 37.12
  const x = Math.max(18, Math.min(382, ((lon - 6.82) / 0.4) * 400));
  const y = Math.max(22, Math.min(438, 460 - ((lat - 36.84) / 0.28) * 460));
  return { x, y };
}

export function createInitialWaypoints(): Waypoint[] {
  return parseSkikdaCsvText(SAMPLE_SKIKDA_CSV, 'skikda_points.csv').map((row, idx) =>
    buildWaypointFromCsvRow(row, idx + 1)
  );
}
