import { McpConfig, PointInteretMed, TrackPoint, Waypoint } from '../types/marine';
import { PROJECT_CONTACT } from './accessControl';
import { SAMPLE_SKIKDA_CSV } from './navigation';

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoreZip(files: Array<{ name: string; content: string }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach(({ name, content }) => {
    const nb = encoder.encode(name);
    const db = encoder.encode(content);
    const crc = crc32(db);

    const local = new Uint8Array(30 + nb.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, db.length, true);
    lv.setUint32(22, db.length, true);
    lv.setUint16(26, nb.length, true);
    local.set(nb, 30);
    localParts.push(local, db);

    const central = new Uint8Array(46 + nb.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, db.length, true);
    cv.setUint32(24, db.length, true);
    cv.setUint16(28, nb.length, true);
    cv.setUint32(42, offset, true);
    central.set(nb, 46);
    centralParts.push(central);

    offset += local.length + db.length;
  });

  const cs = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cs, true);
  ev.setUint32(16, offset, true);

  const blobParts: BlobPart[] = [
    ...localParts.map((u) => new Uint8Array(u)),
    ...centralParts.map((u) => new Uint8Array(u)),
    new Uint8Array(eocd),
  ];

  return new Blob(blobParts, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function buildWorksheetXml(rows: string[][]): string {
  const sheetXml = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map(
            (val, c) =>
              `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`
          )
          .join('')}</row>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetXml}</sheetData></worksheet>`;
}

export function exportWaypointsXlsx(
  waypoints: Waypoint[],
  trackPoints: TrackPoint[] = [],
  pointsInteret: PointInteretMed[] = []
): void {
  const wpHeaders = [
    'id',
    'name',
    'lat',
    'lon',
    'depth',
    'type',
    'distance_nm',
    'cap_deg',
    'confiance_pct',
  ];
  const wpRows = [
    wpHeaders,
    ...waypoints.map((w) => [
      w.id,
      w.name,
      String(w.lat),
      String(w.lon),
      String(w.depthM),
      w.rawType || w.category,
      String(w.distanceNm),
      String(w.bearing),
      String(w.confidence),
    ]),
  ];

  const trackHeaders = ['id', 'timestamp', 'lat', 'lon', 'sog_kts', 'cog_deg', 'depth_m', 'protocol'];
  const trackRows = [
    trackHeaders,
    ...trackPoints.map((t) => [
      t.id,
      t.timestamp,
      String(t.lat),
      String(t.lon),
      String(t.sog),
      String(t.cog),
      String(t.depth),
      t.protocol,
    ]),
  ];

  const poiHeaders = ['id', 'nom', 'secteur', 'pays', 'lat', 'lon', 'type', 'rayon_m', 'source_nmea'];
  const poiRows = [
    poiHeaders,
    ...pointsInteret.map((p) => [
      p.id,
      p.nom,
      p.bassin || p.secteur,
      p.pays || 'Méditerranée',
      String(p.lat),
      String(p.lon),
      p.type,
      String(p.rayon_m),
      p.source_nmea || '$GNRMC',
    ]),
  ];

  const blob = buildStoreZip([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Waypoints_GPS" sheetId="1" r:id="rId1"/><sheet name="visionia_memoire" sheetId="2" r:id="rId2"/><sheet name="PointsInteret_Med" sheetId="3" r:id="rId3"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content: buildWorksheetXml(wpRows),
    },
    {
      name: 'xl/worksheets/sheet2.xml',
      content: buildWorksheetXml(trackRows),
    },
    {
      name: 'xl/worksheets/sheet3.xml',
      content: buildWorksheetXml(poiRows),
    },
  ]);

  triggerFileDownload(blob, 'donnees_visionia.xlsx');
}

export function exportOptimizationJson(
  config: McpConfig,
  waypoints: Waypoint[]
): McpConfig {
  const synced: McpConfig = {
    ...config,
    project_contact: config.project_contact || { ...PROJECT_CONTACT },
    points_navigation: waypoints.map((w) => ({
      id: w.id,
      name: w.name,
      lat: w.lat,
      long: w.lon,
      gps: {
        lat: w.lat,
        lon: w.lon,
        datum: 'WGS84',
      },
      depth: w.depthM,
      type: w.rawType || w.category,
    })),
    saved_places: config.saved_places || [],
    memoire_decisions: config.memoire_decisions || [],
  };

  const payload = {
    schema: 'marinevision.project.structure/v2',
    exported_at: new Date().toISOString(),
    ...synced,
  };

  triggerFileDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    'visionia_optimization.json'
  );
  return synced;
}

export function buildSetupMarineGpsPayload(config: McpConfig, currentDepthM: number) {
  return {
    schema: 'marinevision.gps.setup/v1',
    generated_at: new Date().toISOString(),
    region: config.region,
    MARINE_GPS_TRACKER: config.MARINE_GPS_TRACKER,
    bathymetry: {
      transducer_frequency_khz: 200,
      keel_offset_m: config.MARINE_GPS_TRACKER.bathymetry_depth_offset_m,
      current_chirp_depth_m: currentDepthM,
      thermocline_depth_m: 16.2,
      isobaths_m: config.MARINE_GPS_TRACKER.bathymetry_isobaths_m,
      scan_radius_m: config.mcp_agent.scan_radius_m,
    },
    nmea_bridge: {
      port: config.gnss_nmea.nmea_port,
      baudrate: config.gnss_nmea.baudrate,
      protocol: config.gnss_nmea.protocol_mode,
    },
  };
}

export function exportSetupMarineGpsJson(config: McpConfig, currentDepthM: number): void {
  const payload = buildSetupMarineGpsPayload(config, currentDepthM);
  triggerFileDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    'setup_marine_gps.json'
  );
}

export function exportMarineToolsConfigJson(toolsConfig: McpConfig['marine_tools_config']): void {
  triggerFileDownload(
    new Blob([JSON.stringify(toolsConfig, null, 2)], { type: 'application/json' }),
    'marine_tools_config.json'
  );
}

export function exportMedPointsInteretJson(points: PointInteretMed[]): void {
  const payload = {
    schema: 'marinevision.mediterranee.poi_database/v2',
    app_brand: 'MarineVision Méditerranée',
    contact: PROJECT_CONTACT,
    region: 'Méditerranée · Base Unifiée',
    capture_nmea: '$GNRMC',
    generated_at: new Date().toISOString(),
    PointsInteret: points.map((p) => ({
      ...p,
      gps: { lat: p.lat, lon: p.lon, datum: 'WGS84' },
    })),
  };
  triggerFileDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    'marinevision_mediterranee_poi.json'
  );
}

export function downloadImplScript(scriptText: string, lang: 'javascript' | 'python'): void {
  const ext = lang === 'python' ? 'py' : 'js';
  const mime = lang === 'python' ? 'text/x-python;charset=utf-8' : 'text/javascript;charset=utf-8';
  triggerFileDownload(new Blob([scriptText], { type: mime }), `marinevision_mediterranee_menu.${ext}`);
}

export function exportLieuxNavigationConfigJson(
  config: McpConfig,
  waypoints: Waypoint[]
): void {
  const payload = {
    schema: 'marinevision.lieux_navigation.config/v1',
    generated_at: new Date().toISOString(),
    active_zone_id: config.active_zone_id || 'skikda',
    region: config.region,
    lieux_navigation_ui: config.lieux_navigation_ui,
    points_navigation: waypoints.map((w) => ({
      id: w.id,
      name: w.name,
      lat: w.lat,
      long: w.lon,
      depth: w.depthM,
      type: w.rawType || w.category,
      zone_id: w.zoneId || 'skikda',
      manual_entry: Boolean(w.isManual),
    })),
  };
  triggerFileDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    'lieux_navigation_config.json'
  );
}

export function downloadSampleSkikdaCsv(): void {
  const blob = new Blob([SAMPLE_SKIKDA_CSV], { type: 'text/csv;charset=utf-8' });
  triggerFileDownload(blob, 'skikda_points.csv');
}

export function downloadSyncScript(scriptText: string): void {
  const blob = new Blob([scriptText], { type: 'text/x-python;charset=utf-8' });
  triggerFileDownload(blob, 'sync_visionia_xlsx.py');
}

export const NETLIFY_TOML_PREVIEW = `[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    Permissions-Policy = "geolocation=(self), camera=(self), gyroscope=(self), magnetometer=(self)"

[[headers]]
  for = "/service-worker.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate, max-age=0"
    Service-Worker-Allowed = "/"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate, max-age=0"`;

export function exportNetlifyToml(): void {
  const blob = new Blob([NETLIFY_TOML_PREVIEW + '\n'], { type: 'text/plain;charset=utf-8' });
  triggerFileDownload(blob, 'netlify.toml');
}

