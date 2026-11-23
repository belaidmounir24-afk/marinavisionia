export type TabId = 'dashboard-bento' | 'carte-sonar' | 'waypoints-nav' | 'agent-mcp-config';

export type WaypointCategory = 'fish' | 'wreck' | 'anchor' | 'restricted';

export type NmeaBaudRate = 4800 | 38400;

export type AndroidLocationPermission = 'always' | 'while_using' | 'denied';

export type SubscriptionTier = 'free' | 'one_time' | 'yearly' | 'weekly';

export type MarineFeatureKey =
  | 'ais_stream'
  | 'compass_gps'
  | 'bathymetry_3d'
  | 'ollama_ai_scan'
  | 'nmea_bridge'
  | 'excel_auto_log';

export interface PricingPlanConfig {
  id: 'one_time' | 'yearly' | 'weekly';
  label: 'One Time' | 'Yearly' | 'Weekly';
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
  depth: number;
  type: string;
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

export interface McpConfig {
  region: string;
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
