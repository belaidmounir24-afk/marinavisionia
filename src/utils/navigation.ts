import {
  LocalRagIndex,
  McpConfig,
  NavigationZoneConfig,
  NavigationZoneId,
  NmeaBaudRate,
  PointInteretMed,
  RagIndexEntry,
  TrackPoint,
  Waypoint,
  WaypointCategory,
} from '../types/marine';
import { DEFAULT_MARINE_TOOLS_CONFIG, PROJECT_CONTACT } from './accessControl';

export const VESSEL_LAT = 36.935;
export const VESSEL_LON = 6.955;

export const MANUAL_POINT_TOOLTIP =
  "Saisissez manuellement un point GPS (Nom, Latitude, Longitude) pour enregistrer un repère hors position actuelle et préparer vos routes entre le Golfe de Skikda, la Méditerranée et la Côte d'Azur.";

export const NAVIGATION_ZONES: NavigationZoneConfig[] = [
  {
    id: 'skikda',
    label: 'Golfe de Skikda',
    subtitle: 'Stora — Port de Skikda — Cap de Fer',
    centerLat: 36.935,
    centerLon: 6.955,
    bounds: { minLat: 36.84, maxLat: 37.12, minLon: 6.82, maxLon: 7.22 },
  },
  {
    id: 'mediterranee',
    label: 'Méditerranée',
    subtitle: 'Vue Bassin unifiée — Skikda à Kornati',
    centerLat: 39.2,
    centerLon: 7.1,
    bounds: { minLat: 34.5, maxLat: 44.5, minLon: -4.5, maxLon: 16.0 },
  },
  {
    id: 'cote_dazur',
    label: "Côte d'Azur",
    subtitle: 'Nice — Cap Ferrat — Villefranche',
    centerLat: 43.675,
    centerLon: 7.31,
    bounds: { minLat: 43.55, maxLat: 43.76, minLon: 7.12, maxLon: 7.48 },
  },
  {
    id: 'calanques_marseille',
    label: 'Calanques de Marseille',
    subtitle: 'Morgiou — En-Vau — Cassis (France)',
    centerLat: 43.21,
    centerLon: 5.442,
    bounds: { minLat: 43.15, maxLat: 43.27, minLon: 5.34, maxLon: 5.56 },
  },
  {
    id: 'la_maddalena',
    label: 'Archipel de La Maddalena',
    subtitle: 'Budelli — Spargi — Sardaigne (Italie)',
    centerLat: 41.236,
    centerLon: 9.406,
    bounds: { minLat: 41.17, maxLat: 41.31, minLon: 9.31, maxLon: 9.51 },
  },
  {
    id: 'iles_lavezzi',
    label: 'Îles Lavezzi',
    subtitle: 'Bouches de Bonifacio — Corse (France)',
    centerLat: 41.339,
    centerLon: 9.255,
    bounds: { minLat: 41.29, maxLat: 41.4, minLon: 9.18, maxLon: 9.34 },
  },
  {
    id: 'cap_bon',
    label: 'Cap Bon',
    subtitle: 'Ras Addar — Kélibia — Tunisie',
    centerLat: 37.078,
    centerLon: 11.044,
    bounds: { minLat: 36.82, maxLat: 37.16, minLon: 10.85, maxLon: 11.2 },
  },
  {
    id: 'iles_kornati',
    label: 'Îles Kornati',
    subtitle: 'Parc National — Adriatique (Croatie)',
    centerLat: 43.805,
    centerLon: 15.326,
    bounds: { minLat: 43.7, maxLat: 43.92, minLon: 15.16, maxLon: 15.48 },
  },
  {
    id: 'costa_brava',
    label: 'Costa Brava',
    subtitle: 'Cap de Creus — Begur — Catalogne (Espagne)',
    centerLat: 41.918,
    centerLon: 3.214,
    bounds: { minLat: 41.78, maxLat: 42.34, minLon: 3.05, maxLon: 3.36 },
  },
  {
    id: 'al_hoceima',
    label: 'Al Hoceïma',
    subtitle: "Mer d'Alboran — Îles Cala Iris (Maroc)",
    centerLat: 35.247,
    centerLon: -3.932,
    bounds: { minLat: 35.14, maxLat: 35.34, minLon: -4.15, maxLon: -3.76 },
  },
];

export function getNavigationZone(zoneId?: NavigationZoneId): NavigationZoneConfig {
  return NAVIGATION_ZONES.find((z) => z.id === zoneId) || NAVIGATION_ZONES[0];
}

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
  app_brand: 'MarineVision Méditerranée',
  project_contact: { ...PROJECT_CONTACT },
  region: 'Méditerranée',
  active_zone_id: 'skikda',
  lieux_navigation_ui: {
    dynamic_selector: true,
    selected_zone: 'skikda',
    available_zones: NAVIGATION_ZONES,
    quick_gps_capture: {
      enabled: true,
      button_label: 'Enregistrer ma position',
      card_title: 'Capture GPS Sans Saisie',
      card_cta: 'Enregistrer ce lieu',
    },
    manual_entry: {
      enabled: true,
      button_label: 'Ajouter point manuel',
      fields: ['name', 'lat', 'lon', 'depth', 'category'],
      tooltip: MANUAL_POINT_TOOLTIP,
    },
  },
  pwa_deploy: {
    github_repo: 'marinevision-ai/skikda-cockpit',
    github_branch: 'main',
    netlify_site: 'marinevision-skikda.netlify.app',
    netlify_auto_publish: true,
    sw_strategy: 'Network-First',
    skip_waiting: true,
    anti_cache_headers: true,
    permissions_policy: ['geolocation', 'camera', 'gyroscope', 'magnetometer'],
    last_deploy_at: '2026-11-23T04:20:00Z',
  },
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
  points_interet: [],
};

export const DEFAULT_MED_POINTS_INTERET: PointInteretMed[] = [
  {
    id: 'POI-MED-01',
    nom: 'Golfe de Skikda · Rade de Stora',
    secteur: 'Stora — Port de Skikda — Cap de Fer',
    bassin: 'Bassin Algéro-Provençal Sud',
    pays: 'Algérie',
    lat: 36.935,
    lon: 6.955,
    rayon_m: 650,
    type: 'port',
    alerte_collision_ia: false,
    source_nmea: '$GNRMC',
    tags: ['skikda', 'stora', 'algerie', 'mouillage', 'port'],
    rag_indexed: true,
  },
  {
    id: 'POI-MED-02',
    nom: 'Calanques de Marseille',
    secteur: 'Morgiou — En-Vau — Cassis',
    bassin: 'Golfe du Lion',
    pays: 'France',
    lat: 43.21,
    lon: 5.442,
    rayon_m: 500,
    type: 'mouillage',
    alerte_collision_ia: true,
    source_nmea: '$GNRMC',
    tags: ['marseille', 'calanques', 'france', 'mouillage', 'parc'],
    rag_indexed: true,
  },
  {
    id: 'POI-MED-03',
    nom: 'Archipel de La Maddalena',
    secteur: 'Budelli — Spargi — Sardaigne Nord',
    bassin: 'Mer Tyrrhénienne',
    pays: 'Italie',
    lat: 41.236,
    lon: 9.406,
    rayon_m: 700,
    type: 'mouillage',
    alerte_collision_ia: true,
    source_nmea: '$GNRMC',
    tags: ['maddalena', 'sardaigne', 'italie', 'archipel', 'mouillage'],
    rag_indexed: true,
  },
  {
    id: 'POI-MED-04',
    nom: 'Îles Lavezzi',
    secteur: 'Réserve des Bouches de Bonifacio',
    bassin: 'Corse Sud · Tyrrhénienne',
    pays: 'France',
    lat: 41.339,
    lon: 9.255,
    rayon_m: 600,
    type: 'danger',
    alerte_collision_ia: true,
    source_nmea: '$GNRMC',
    tags: ['lavezzi', 'corse', 'bonifacio', 'recifs', 'danger'],
    rag_indexed: true,
  },
  {
    id: 'POI-MED-05',
    nom: 'Cap Bon · Ras Addar',
    secteur: 'Passage Canal de Sicile',
    bassin: 'Bassin Tuniso-Sicilien',
    pays: 'Tunisie',
    lat: 37.078,
    lon: 11.044,
    rayon_m: 900,
    type: 'peche',
    alerte_collision_ia: false,
    source_nmea: '$GNRMC',
    tags: ['cap bon', 'tunisie', 'sicile', 'peche', 'courant'],
    rag_indexed: true,
  },
  {
    id: 'POI-MED-06',
    nom: 'Îles Kornati',
    secteur: 'Archipel Dalmate · Parc National',
    bassin: 'Mer Adriatique',
    pays: 'Croatie',
    lat: 43.805,
    lon: 15.326,
    rayon_m: 750,
    type: 'mouillage',
    alerte_collision_ia: false,
    source_nmea: '$GNRMC',
    tags: ['kornati', 'croatie', 'adriatique', 'archipel', 'mouillage'],
    rag_indexed: true,
  },
  {
    id: 'POI-MED-07',
    nom: 'Costa Brava · Cap de Creus',
    secteur: 'Begur — Cadaqués — Catalogne',
    bassin: 'Mer des Baléares',
    pays: 'Espagne',
    lat: 41.918,
    lon: 3.214,
    rayon_m: 550,
    type: 'peche',
    alerte_collision_ia: false,
    source_nmea: '$GNRMC',
    tags: ['costa brava', 'espagne', 'catalogne', 'creus', 'peche'],
    rag_indexed: true,
  },
  {
    id: 'POI-MED-08',
    nom: 'Al Hoceïma · Baie & Îles',
    secteur: 'Cala Iris — Côte Rifaine',
    bassin: "Mer d'Alboran",
    pays: 'Maroc',
    lat: 35.247,
    lon: -3.932,
    rayon_m: 600,
    type: 'mouillage',
    alerte_collision_ia: true,
    source_nmea: '$GNRMC',
    tags: ['al hoceima', 'maroc', 'alboran', 'rif', 'mouillage'],
    rag_indexed: true,
  },
];

export function buildLocalRagIndex(
  pois: PointInteretMed[],
  zones: NavigationZoneConfig[] = NAVIGATION_ZONES
): LocalRagIndex {
  const now = new Date().toISOString();
  const entries: RagIndexEntry[] = [
    ...pois.map((poi) => ({
      doc_id: poi.id,
      title: poi.nom,
      secteur: poi.secteur,
      bassin: poi.bassin || 'Méditerranée',
      lat: poi.lat,
      lon: poi.lon,
      keywords: [
        poi.nom.toLowerCase(),
        poi.secteur.toLowerCase(),
        (poi.bassin || '').toLowerCase(),
        (poi.pays || '').toLowerCase(),
        poi.type,
        ...(poi.tags || []),
      ].filter(Boolean),
      indexed_at: now,
    })),
    ...zones
      .filter((z) => !pois.some((p) => p.nom.toLowerCase().includes(z.label.toLowerCase())))
      .map((z) => ({
        doc_id: `ZONE-${z.id.toUpperCase()}`,
        title: z.label,
        secteur: z.subtitle,
        bassin: 'Méditerranée',
        lat: z.centerLat,
        lon: z.centerLon,
        keywords: [z.label.toLowerCase(), z.subtitle.toLowerCase(), z.id],
        indexed_at: now,
      })),
  ];
  return {
    schema: 'marinevision.rag_index.mediterranee/v1',
    app_brand: 'MarineVision Méditerranée',
    total_docs: entries.length,
    last_indexed_at: now,
    entries,
  };
}

export function queryLocalRagIndex(index: LocalRagIndex, rawQuery: string): RagIndexEntry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return index.entries;
  const terms = q.split(/\s+/).filter(Boolean);
  return index.entries.filter((entry) => {
    const haystack = [entry.doc_id, entry.title, entry.secteur, entry.bassin, ...entry.keywords]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function calculateGpsDistance(
  originLat: number,
  originLon: number,
  targetLat: number,
  targetLon: number
): { distanceKm: number; distanceNm: number; bearingDeg: number; cardinal: string } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R_KM = 6371.0088;
  const dLat = toRad(targetLat - originLat);
  const dLon = toRad(targetLon - originLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(originLat)) * Math.cos(toRad(targetLat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const distanceKm = +(R_KM * c).toFixed(1);
  const distanceNm = +(distanceKm / 1.852).toFixed(1);
  const y = Math.sin(dLon) * Math.cos(toRad(targetLat));
  const x =
    Math.cos(toRad(originLat)) * Math.sin(toRad(targetLat)) -
    Math.sin(toRad(originLat)) * Math.cos(toRad(targetLat)) * Math.cos(dLon);
  const bearingDeg = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  return {
    distanceKm,
    distanceNm,
    bearingDeg,
    cardinal: getCardinal(bearingDeg),
  };
}

export function buildSelectionMenuScript(
  lang: 'javascript' | 'python',
  pois: PointInteretMed[]
): string {
  const compactPois = pois.map((p) => ({
    id: p.id,
    nom: p.nom,
    lat: p.lat,
    lon: p.lon,
    bassin: p.bassin || 'Méditerranée',
  }));

  if (lang === 'python') {
    return `#!/usr/bin/env python3
# MarineVision Méditerranée — Menu de sélection & calcul de distance GPS (Haversine)
import math

MED_POINTS_INTERET = ${JSON.stringify(compactPois, null, 2)}

def distance_gps_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r_nm = 3440.065
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return round(2 * r_nm * math.asin(min(1.0, math.sqrt(a))), 1)

def menu_selection(pos_lat: float = 36.9350, pos_lon: float = 6.9550) -> None:
    print("=== MarineVision Méditerranée — Sélection Point d'Intérêt ===")
    for idx, poi in enumerate(MED_POINTS_INTERET, start=1):
        dist = distance_gps_nm(pos_lat, pos_lon, poi["lat"], poi["lon"])
        print(f"[{idx}] {poi['nom']} ({poi['bassin']}) -> {dist} NM")
    choix = int(input("Choisissez un numéro (ou 0 pour saisie libre) : "))
    if choix == 0:
        lat = float(input("Latitude libre : "))
        lon = float(input("Longitude libre : "))
        print(f"Distance vers coordonnées libres : {distance_gps_nm(pos_lat, pos_lon, lat, lon)} NM")
    elif 1 <= choix <= len(MED_POINTS_INTERET):
        cible = MED_POINTS_INTERET[choix - 1]
        print(f"Cap engagé vers {cible['nom']} ({cible['lat']}, {cible['lon']})")

if __name__ == "__main__":
    menu_selection()
`;
  }

  return `// MarineVision Méditerranée — Menu déroulant dynamique + calcul distance GPS (Haversine)
export const MED_POINTS_INTERET = ${JSON.stringify(compactPois, null, 2)};

export function calculateGpsDistanceNm(originLat, originLon, targetLat, targetLon) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R_NM = 3440.065;
  const dLat = toRad(targetLat - originLat);
  const dLon = toRad(targetLon - originLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(originLat)) * Math.cos(toRad(targetLat)) * Math.sin(dLon / 2) ** 2;
  return +(2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)))).toFixed(1);
}

export function mountMediterraneanSelector(selectEl, outputEl) {
  MED_POINTS_INTERET.forEach((poi) => {
    const opt = document.createElement('option');
    opt.value = poi.id;
    opt.textContent = \`\${poi.nom} — \${poi.bassin}\`;
    selectEl.appendChild(opt);
  });

  selectEl.addEventListener('change', () => {
    const target = MED_POINTS_INTERET.find((p) => p.id === selectEl.value);
    if (!target) return;
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      const nm = calculateGpsDistanceNm(coords.latitude, coords.longitude, target.lat, target.lon);
      outputEl.textContent = \`\${target.nom} : \${nm} NM depuis votre position GPS\`;
    });
  });
}
`;
}

export function parseGnrmcCoords(sentence: string): { lat: number; lon: number } | null {
  const match = sentence.match(/\$GNRMC,[^,]*,[AV],(\d{2})(\d{2}\.\d+),([NS]),(\d{3})(\d{2}\.\d+),([EW])/i);
  if (!match) return null;
  const latDeg = parseInt(match[1], 10);
  const latMin = parseFloat(match[2]);
  const latSign = match[3].toUpperCase() === 'S' ? -1 : 1;
  const lonDeg = parseInt(match[4], 10);
  const lonMin = parseFloat(match[5]);
  const lonSign = match[6].toUpperCase() === 'W' ? -1 : 1;
  const lat = +(latSign * (latDeg + latMin / 60)).toFixed(5);
  const lon = +(lonSign * (lonDeg + lonMin / 60)).toFixed(5);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

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

export function computeNavVector(
  lat: number,
  lon: number,
  originLat = VESSEL_LAT,
  originLon = VESSEL_LON
): { distNm: number; bearing: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R_NM = 3440.065;
  const dLat = toRad(lat - originLat);
  const dLon = toRad(lon - originLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(originLat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
  const distNm = 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)));
  const y = Math.sin(dLon) * Math.cos(toRad(lat));
  const x =
    Math.cos(toRad(originLat)) * Math.sin(toRad(lat)) -
    Math.sin(toRad(originLat)) * Math.cos(toRad(lat)) * Math.cos(dLon);
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
  zoneId?: NavigationZoneId;
  isManual?: boolean;
}

export function buildWaypointFromCsvRow(input: CsvWaypointInput, idx: number): Waypoint {
  const cat = normalizeCsvType(input.type);
  const zone = input.zoneId ? getNavigationZone(input.zoneId) : NAVIGATION_ZONES[0];
  const vec = computeNavVector(input.lat, input.lon, zone.centerLat, zone.centerLon);
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
    zoneId: input.zoneId || 'skikda',
    isManual: Boolean(input.isManual),
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

export function projectLatLonToSvg(
  lat: number,
  lon: number,
  zone?: NavigationZoneConfig
): { x: number; y: number } {
  const bounds = zone?.bounds || NAVIGATION_ZONES[0].bounds;
  const lonSpan = Math.max(0.05, bounds.maxLon - bounds.minLon);
  const latSpan = Math.max(0.05, bounds.maxLat - bounds.minLat);
  const x = Math.max(18, Math.min(382, ((lon - bounds.minLon) / lonSpan) * 400));
  const y = Math.max(22, Math.min(438, 460 - ((lat - bounds.minLat) / latSpan) * 460));
  return { x, y };
}

const EXTRA_ZONE_PRESETS: CsvWaypointInput[] = [
  {
    name: 'Corridor Hauturier Algéro-Provençal',
    lat: 38.72,
    lon: 6.35,
    depth: 185,
    type: 'fish',
    sourceFile: 'mediterranee_zones.json',
    zoneId: 'mediterranee',
  },
  {
    name: 'Banc des Écueils · Large',
    lat: 37.92,
    lon: 7.45,
    depth: 64,
    type: 'wreck',
    sourceFile: 'mediterranee_zones.json',
    zoneId: 'mediterranee',
  },
  {
    name: 'Mouillage Sud Sardaigne',
    lat: 38.94,
    lon: 8.42,
    depth: 19,
    type: 'anchor',
    sourceFile: 'mediterranee_zones.json',
    zoneId: 'mediterranee',
  },
  {
    name: 'Rade de Villefranche-sur-Mer',
    lat: 43.696,
    lon: 7.316,
    depth: 22,
    type: 'anchor',
    sourceFile: 'cote_dazur_zones.json',
    zoneId: 'cote_dazur',
  },
  {
    name: 'Cap Ferrat · Tombant Est',
    lat: 43.679,
    lon: 7.338,
    depth: 48,
    type: 'wreck',
    sourceFile: 'cote_dazur_zones.json',
    zoneId: 'cote_dazur',
  },
  {
    name: 'Baie des Anges · Banc Pélagique',
    lat: 43.662,
    lon: 7.245,
    depth: 36,
    type: 'fish',
    sourceFile: 'cote_dazur_zones.json',
    zoneId: 'cote_dazur',
  },
  {
    name: 'Calanque de Morgiou',
    lat: 43.21,
    lon: 5.442,
    depth: 16,
    type: 'anchor',
    sourceFile: 'mediterranee_unifiee.json',
    zoneId: 'calanques_marseille',
  },
  {
    name: 'Île Budelli · Cala Corsara',
    lat: 41.236,
    lon: 9.406,
    depth: 14,
    type: 'anchor',
    sourceFile: 'mediterranee_unifiee.json',
    zoneId: 'la_maddalena',
  },
  {
    name: 'Cala Lazarina · Îles Lavezzi',
    lat: 41.339,
    lon: 9.255,
    depth: 12,
    type: 'restricted',
    sourceFile: 'mediterranee_unifiee.json',
    zoneId: 'iles_lavezzi',
  },
  {
    name: 'Ras Addar · Cap Bon',
    lat: 37.078,
    lon: 11.044,
    depth: 44,
    type: 'fish',
    sourceFile: 'mediterranee_unifiee.json',
    zoneId: 'cap_bon',
  },
  {
    name: 'Telašćica · Îles Kornati',
    lat: 43.805,
    lon: 15.326,
    depth: 26,
    type: 'anchor',
    sourceFile: 'mediterranee_unifiee.json',
    zoneId: 'iles_kornati',
  },
  {
    name: 'Cap de Creus · Costa Brava',
    lat: 41.918,
    lon: 3.214,
    depth: 38,
    type: 'wreck',
    sourceFile: 'mediterranee_unifiee.json',
    zoneId: 'costa_brava',
  },
  {
    name: 'Cala Iris · Al Hoceïma',
    lat: 35.247,
    lon: -3.932,
    depth: 21,
    type: 'anchor',
    sourceFile: 'mediterranee_unifiee.json',
    zoneId: 'al_hoceima',
  },
];

export function createInitialWaypoints(): Waypoint[] {
  const skikdaRows = parseSkikdaCsvText(SAMPLE_SKIKDA_CSV, 'skikda_points.csv').map((row) => ({
    ...row,
    zoneId: 'skikda' as NavigationZoneId,
  }));
  return [...skikdaRows, ...EXTRA_ZONE_PRESETS].map((row, idx) =>
    buildWaypointFromCsvRow(row, idx + 1)
  );
}
