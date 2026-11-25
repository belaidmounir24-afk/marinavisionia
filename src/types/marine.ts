export type TabId = 'dashboard-bento' | 'carte-sonar' | 'waypoints-nav' | 'agent-mcp-config';

export type NavigationZoneId =
  | 'skikda'
  | 'mediterranee'
  | 'cote_dazur'
  | 'calanques_marseille'
  | 'la_maddalena'
  | 'iles_lavezzi'
  | 'cap_bon'
  | 'iles_kornati'
  | 'costa_brava'
  | 'al_hoceima';

export interface NavigationZoneConfig {
  id: NavigationZoneId;
  label: string;
  subtitle: string;
  centerLat: number;
  centerLon: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export interface LieuxNavigationUiConfig {
  dynamic_selector: boolean;
  selected_zone: NavigationZoneId;
  available_zones: NavigationZoneConfig[];
  quick_gps_capture: {
    enabled: boolean;
    button_label: string;
    card_title: string;
    card_cta: string;
  };
  manual_entry: {
    enabled: boolean;
    button_label: string;
    fields: Array<'name' | 'lat' | 'lon' | 'depth' | 'category'>;
    tooltip: string;
  };
}

export type WaypointCategory = 'fish' | 'wreck' | 'anchor' | 'restricted';

export type NmeaBaudRate = 4800 | 38400;

export type AndroidLocationPermission = 'always' | 'while_using' | 'denied';

export type SubscriptionTier =
  | 'free'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'one_time'
  | 'yearly'
  | 'weekly';

export type MarineFeatureKey =
  | 'ais_stream'
  | 'compass_gps'
  | 'bathymetry_3d'
  | 'ollama_ai_scan'
  | 'nmea_bridge'
  | 'excel_auto_log'
  | 'collision_ai_alerts'
  | 'unlimited_history';

export interface PricingPlanConfig {
  id: 'monthly' | 'quarterly' | 'annual' | 'one_time' | 'yearly' | 'weekly';
  label: string;
  price_eur: number;
  billing_cycle: string;
}

export interface FeatureAccessRule {
  label: string;
  required_tier: 'free' | 'premium';
  enabled: boolean;
}

export interface MarineToolsConfig {
  schema: string;
  active_plan: SubscriptionTier;
  plans: PricingPlanConfig[];
  pricing_revised: boolean;
  features: Record<MarineFeatureKey, FeatureAccessRule>;
  sensors_api: {
    geolocation: string;
    compass: string;
    ais_provider: string;
  };
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: WaypointCategory;
  rawType: string;
  badge: string;
  distanceNm: number;
  bearing: number;
  depthM: number;
  metaLabel1: string;
  metaValue1: string;
  metaLabel2: string;
  metaValue2: string;
  timestamp: string;
  coords: string;
  aiDetected: boolean;
  confidence: number;
  zoneId?: NavigationZoneId;
  isManual?: boolean;
}

export interface TrackPoint {
  id: string;
  timestamp: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  depth: number;
  protocol: string;
}

export interface McpPointSummary {
  id: string;
  name: string;
  lat: number;
  long: number;
  gps?: {
    lat: number;
    lon: number;
    datum: 'WGS84';
  };
  depth: number;
  type: string;
}

export interface ProjectContactConfig {
  organization: string;
  phone: string;
  email: string;
  region: string;
}

export interface GeofenceConfig {
  enabled: boolean;
  zone_name: string;
  lat: number;
  lon: number;
  radius_m: number;
  alert_on_entry: boolean;
}

export interface GnssNmeaConfig {
  android_permission: AndroidLocationPermission;
  antenna_clear_sky: boolean;
  update_interval_ms: number;
  nmea_connected: boolean;
  nmea_port: string;
  baudrate: NmeaBaudRate;
  protocol_mode: 'NMEA 0183' | 'NMEA 0183 + AIS';
  constellations: {
    gps: boolean;
    glonass: boolean;
    galileo: boolean;
  };
  record_to_memoire: boolean;
  auto_sync_xlsx: boolean;
}

export interface MarineGpsTrackerConfig {
  enabled: boolean;
  sensor_id: string;
  hardware_hook_active: boolean;
  sampling_rate: string;
  frequency_hz: number;
  buffer_size: number;
  auto_log_excel: boolean;
  auto_log_interval_sec: number;
  target_file: string;
  bathymetry_depth_offset_m: number;
  bathymetry_isobaths_m: number[];
}

export interface PwaDeployConfig {
  github_repo: string;
  github_branch: string;
  netlify_site: string;
  netlify_auto_publish: boolean;
  sw_strategy: 'Network-First';
  skip_waiting: boolean;
  anti_cache_headers: boolean;
  permissions_policy: Array<'geolocation' | 'camera' | 'gyroscope' | 'magnetometer'>;
  last_deploy_at: string;
}

export interface SavedPlaceRecord {
  id: string;
  name: string;
  lat: number;
  lon: number;
  accuracyM?: number;
  category: WaypointCategory;
  source: 'navigator.geolocation' | 'gnss_fallback';
  createdAt: string;
  waypointId: string;
}

export interface MemoireDecision {
  id: string;
  note: string;
  timestamp: string;
}

export interface PointInteretMed {
  id: string;
  nom: string;
  secteur: string;
  bassin?: string;
  pays?: string;
  lat: number;
  lon: number;
  rayon_m: number;
  type: 'mouillage' | 'peche' | 'danger' | 'port';
  alerte_collision_ia: boolean;
  source_nmea?: string;
  tags?: string[];
  rag_indexed?: boolean;
}

export interface RagIndexEntry {
  doc_id: string;
  title: string;
  secteur: string;
  bassin: string;
  lat: number;
  lon: number;
  keywords: string[];
  indexed_at: string;
}

export interface LocalRagIndex {
  schema: string;
  app_brand: 'MarineVision Méditerranée';
  total_docs: number;
  last_indexed_at: string;
  entries: RagIndexEntry[];
}

export interface ManualLicenseRecord {
  code: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  provider: 'Manuel' | 'Stripe' | 'PayPal';
  status: 'active' | 'none';
  activatedAt: string;
  storedIn: 'visionia_memoire';
}

export interface McpConfig {
  app_brand?: string;
  project_contact?: ProjectContactConfig;
  region: string;
  active_zone_id?: NavigationZoneId;
  lieux_navigation_ui?: LieuxNavigationUiConfig;
  rag_index?: LocalRagIndex;
  pwa_deploy: PwaDeployConfig;
  marine_tools_config: MarineToolsConfig;
  MARINE_GPS_TRACKER: MarineGpsTrackerConfig;
  mcp_agent: {
    auto_pilot: boolean;
    biomass_threshold: number;
    min_cluster_size: number;
    sonar_beam_angle: number;
    scan_radius_m: number;
    auto_export_nmea: boolean;
    export_interval_sec: number;
    low_power_mode: boolean;
    ai_transit_sleep: boolean;
    process_type: string;
    mode: string;
  };
  geofence: GeofenceConfig;
  gnss_nmea: GnssNmeaConfig;
  points_navigation: McpPointSummary[];
  points_interet?: PointInteretMed[];
  saved_places?: SavedPlaceRecord[];
  memoire_decisions?: MemoireDecision[];
}

export interface McpLogEntry {
  id: string;
  time: string;
  tag: string;
  source: string;
  detail: string;
}

export interface ImportHistoryEntry {
  date: string;
  file: string;
  count: number;
}

export interface SatelliteStatus {
  gps: number;
  glonass: number;
  galileo: number;
  hdop: number;
  fixType: string;
}

export interface TelemetryState {
  sog: number;
  cog: number;
  depth: number;
  chirpDepth: number;
  battery: number;
  gpuLoad: number;
  gpuTemp: number;
  memoryBufferMb: number;
  latency: number;
  bentoLatency: number;
  fps: number;
  gnssSynced: boolean;
  gnssOffsetM: number;
  gnssAnchor: string;
  satellites: SatelliteStatus;
  nmeaSentence: string;
}

export interface RadarBlipTarget {
  id: string;
  name: string;
  depth: string;
  type: string;
  cert: string;
  label: string;
  positionClass: string;
  color: 'cyan' | 'amber' | 'teal';
}
