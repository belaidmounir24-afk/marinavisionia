import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Fish,
  Layers,
  MapPin,
  MapPinPlus,
  Cpu,
  Ruler,
  Waves,
  CheckCircle2,
  LocateFixed,
  Power,
  ShieldAlert,
  Radio,
  Satellite,
} from 'lucide-react';
import {
  GeofenceConfig,
  GnssNmeaConfig,
  NavigationZoneConfig,
  SavedPlaceRecord,
  TelemetryState,
  TrackPoint,
  Waypoint,
} from '../types/marine';
import { NAVIGATION_ZONES, projectLatLonToSvg } from '../utils/navigation';

export interface ActiveScanArea {
  lat: number;
  lon: number;
  radiusM: number;
  label: string;
  generatedCount: number;
}

interface SonarMapViewProps {
  telemetry: TelemetryState;
  waypoints: Waypoint[];
  savedPlaces: SavedPlaceRecord[];
  trackMemoire: TrackPoint[];
  activeWaypointId: string;
  overlayMode: string;
  lowPowerMode: boolean;
  aiTransitSleep: boolean;
  fishVisible: boolean;
  scanRadiusM: number;
  activeScanArea: ActiveScanArea | null;
  geofence: GeofenceConfig;
  gnssNmea: GnssNmeaConfig;
  activeZone?: NavigationZoneConfig;
  isAdmin?: boolean;
  isCapturingPosition?: boolean;
  onSaveCurrentPosition: () => void;
  onToggleFishVisible: () => void;
  onToggleAiTransitSleep: () => void;
  onGnssSync: () => void;
  onSelectWaypoint: (id: string) => void;
  onCreateWaypoint: () => void;
  onScanAreaOllama: (radiusM: number) => {
    species: string;
    conf: string;
    zone: string;
  };
  onNotify: (msg: string) => void;
}

const MAP_MODES = [
  { id: 'bathy', name: 'Bathy 3D', fill: 'url(#deepBlue)', showGrid: true },
  { id: 'satellite', name: 'Satellite', fill: 'url(#satBlue)', showGrid: false },
  { id: 'navionics', name: 'Navionics', fill: '#081c2e', showGrid: true },
] as const;

export const SonarMapView: React.FC<SonarMapViewProps> = ({
  telemetry,
  waypoints,
  savedPlaces,
  trackMemoire,
  activeWaypointId,
  overlayMode,
  lowPowerMode,
  aiTransitSleep,
  fishVisible,
  scanRadiusM,
  activeScanArea,
  geofence,
  gnssNmea,
  activeZone = NAVIGATION_ZONES[0],
  isAdmin = true,
  isCapturingPosition = false,
  onSaveCurrentPosition,
  onToggleFishVisible,
  onToggleAiTransitSleep,
  onGnssSync,
  onSelectWaypoint,
  onCreateWaypoint,
  onScanAreaOllama,
  onNotify,
}) => {
  const [mapModeIdx, setMapModeIdx] = useState(1);
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [scanResult, setScanResult] = useState({
    species: 'Banc de pageots & sardines (Stora Nord)',
    conf: '94% CONF.',
    zone: 'Z: 24-32m',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);

  const drawEchoColumn = (ctx: CanvasRenderingContext2D, x: number, h: number, phase: number) => {
    ctx.fillStyle = '#040910';
    ctx.fillRect(x, 0, 2, h);

    ctx.fillStyle = 'rgba(0, 242, 254, 0.28)';
    ctx.fillRect(x, 4, 2, 3);

    const thermY = h * 0.34 + Math.sin(phase * 0.08) * 2;
    ctx.fillStyle = 'rgba(64, 220, 202, 0.5)';
    ctx.fillRect(x, thermY, 2, 1.5);

    if (!aiTransitSleep) {
      const cyc = phase % 105;
      if (cyc > 24 && cyc < 58) {
        const t = (cyc - 41) / 17;
        ctx.fillStyle = Math.abs(t) < 0.35 ? '#ffb4ab' : '#ffba38';
        ctx.fillRect(x, h * 0.58 + t * t * 14, 2, 4);
      }
      if (cyc > 50 && cyc < 76) {
        const t2 = (cyc - 63) / 13;
        ctx.fillStyle = '#ffd491';
        ctx.fillRect(x, h * 0.67 + t2 * t2 * 10, 2, 3);
      }
    }

    const seabedY = h * 0.82 + Math.sin(phase * 0.05) * 3;
    ctx.fillStyle = '#ffba38';
    ctx.fillRect(x, seabedY, 2, 3);
    ctx.fillStyle = '#93000a';
    ctx.fillRect(x, seabedY + 3, 2, h - seabedY);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
        for (let x = 0; x < canvas.width; x += 2) {
          phaseRef.current += 1;
          drawEchoColumn(ctx, x, canvas.height, phaseRef.current);
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const intervalMs = aiTransitSleep ? 260 : lowPowerMode ? 180 : 90;
    const timer = window.setInterval(() => {
      if (canvas.width < 4 || canvas.height < 4) return;
      const img = ctx.getImageData(2, 0, canvas.width - 2, canvas.height);
      ctx.putImageData(img, 0, 0);
      phaseRef.current += 1;
      drawEchoColumn(ctx, canvas.width - 2, canvas.height, phaseRef.current);
    }, intervalMs);

    return () => {
      window.removeEventListener('resize', resize);
      window.clearInterval(timer);
    };
  }, [lowPowerMode, aiTransitSleep]);

  const currentMode = MAP_MODES[mapModeIdx];
  const isSatellite = currentMode.id === 'satellite';

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!measureActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 460;
    setMeasurePoints((prev) => (prev.length >= 2 ? [{ x, y }] : [...prev, { x, y }]));
  };

  let measureLabel = 'Mode Règle : cliquez 2 points sur la carte';
  if (measurePoints.length === 1) {
    measureLabel = 'Point A fixé — cliquez le Point B';
  } else if (measurePoints.length === 2) {
    const [p1, p2] = measurePoints;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distNm = (Math.hypot(dx, dy) * 0.045).toFixed(2);
    const brg = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
    measureLabel = `Distance : ${distNm} NM · Cap : ${brg}°`;
  }

  const gnssDriftTransform = telemetry.gnssSynced ? 'translate(0, 0)' : 'translate(10, -7)';

  const geofencePos = projectLatLonToSvg(geofence.lat, geofence.lon, activeZone);
  const geofenceSvgRadius = Math.max(18, Math.min(65, (geofence.radius_m / 800) * 32));

  const scanPos = activeScanArea
    ? projectLatLonToSvg(activeScanArea.lat, activeScanArea.lon, activeZone)
    : projectLatLonToSvg(activeZone.centerLat, activeZone.centerLon, activeZone);
  const scanSvgRadius = Math.max(
    20,
    Math.min(72, ((activeScanArea?.radiusM ?? scanRadiusM) / 500) * 28)
  );

  const trackPointsSvg = trackMemoire
    .map((pt) => {
      const { x, y } = projectLatLonToSvg(pt.lat, pt.lon, activeZone);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const totalSat =
    (gnssNmea.constellations.gps ? telemetry.satellites.gps : 0) +
    (gnssNmea.constellations.glonass ? telemetry.satellites.glonass : 0) +
    (gnssNmea.constellations.galileo ? telemetry.satellites.galileo : 0);

  return (
    <div className="space-y-5">
      {/* GNSS & NMEA Telemetry Strip */}
      <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  telemetry.gnssSynced && gnssNmea.antenna_clear_sky
                    ? 'bg-[#40dcca] animate-pulse'
                    : 'bg-[#ffba38]'
                }`}
                aria-hidden="true"
              />
              <span className={telemetry.gnssSynced ? 'text-[#40dcca]' : 'text-[#ffba38]'}>
                {telemetry.gnssSynced
                  ? `GNSS Calibré · ${telemetry.gnssAnchor}`
                  : `Dérive carte (${telemetry.gnssOffsetM.toFixed(1)} m)`}
              </span>
              <span className="text-[#9eb2b8]">·</span>
              <span className="text-[#00f2fe] flex items-center gap-1">
                <Satellite className="w-3.5 h-3.5" />
                <span>
                  {totalSat} sats ({telemetry.satellites.fixType} · HDOP{' '}
                  {telemetry.satellites.hdop.toFixed(1)})
                </span>
              </span>
            </div>
            <div className="text-xs font-mono text-[#9eb2b8] mt-1 tabular-nums flex flex-wrap items-center gap-2">
              <span className="text-[#e0fdff]">36°56.100&apos; N · 006°57.300&apos; E</span>
              <span>·</span>
              <span className="flex items-center gap-1 text-[#40dcca]">
                <Radio className="w-3 h-3" />
                {gnssNmea.nmea_connected
                  ? `${gnssNmea.nmea_port} (${gnssNmea.baudrate} baud · ${gnssNmea.protocol_mode})`
                  : 'NMEA déconnecté'}
              </span>
              {gnssNmea.android_permission !== 'always' && (
                <span className="text-[#ffb4ab]">
                  · Android : autorisation &quot;Toujours autoriser&quot; requise
                </span>
              )}
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={onGnssSync}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                telemetry.gnssSynced
                  ? 'bg-[#19202a] border border-[#40dcca]/50 text-[#40dcca]'
                  : 'bg-[#ffba38] hover:bg-[#ffd491] text-[#002022]'
              }`}
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>{telemetry.gnssSynced ? 'GNSS Stora Sync OK' : '/gnss_sync (Stora)'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] font-mono text-[#9eb2b8]">SOG</div>
            <div className="text-base font-mono font-bold text-[#40dcca] tabular-nums">
              {telemetry.sog.toFixed(1)} kts
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-[#9eb2b8]">COG</div>
            <div className="text-base font-mono font-bold text-[#00f2fe] tabular-nums">
              {String(telemetry.cog).padStart(3, '0')}°
            </div>
          </div>
          {isAdmin && (
            <div className="text-right">
              <div className="text-[11px] font-mono text-[#9eb2b8]">visionia_memoire</div>
              <div className="text-xs font-mono font-semibold text-[#e0fdff] tabular-nums">
                {trackMemoire.length} pts ({overlayMode})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split Tactical Viewport: Left Map, Right CHIRP Echogram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Tactical SVG Map */}
        <section className="lg:col-span-7 relative rounded-xl bg-[#06101a] border border-[#3a494b]/60 overflow-hidden min-h-[460px]">
          <svg
            onClick={handleSvgClick}
            className={`w-full h-[460px] lg:h-full block ${measureActive ? 'cursor-crosshair' : ''}`}
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 400 460"
          >
            <defs>
              <radialGradient cx="55%" cy="40%" id="deepBlue" r="70%">
                <stop offset="0%" stopColor="#021727" />
                <stop offset="45%" stopColor="#052840" />
                <stop offset="85%" stopColor="#031b2e" />
                <stop offset="100%" stopColor="#010e1a" />
              </radialGradient>
              <linearGradient id="satBlue" x1="15%" y1="100%" x2="80%" y2="0%">
                <stop offset="0%" stopColor="#0d3d4d" />
                <stop offset="35%" stopColor="#082d42" />
                <stop offset="70%" stopColor="#041b2c" />
                <stop offset="100%" stopColor="#020d17" />
              </linearGradient>
              <radialGradient cx="42%" cy="32%" id="satFosse" r="55%">
                <stop offset="0%" stopColor="#020b14" stopOpacity="0.85" />
                <stop offset="65%" stopColor="#041d30" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#073146" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="depthGradient" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#00c0ae" stopOpacity="0.32" />
                <stop offset="50%" stopColor="#00696f" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#002022" stopOpacity="0.5" />
              </linearGradient>
            </defs>

            <rect fill={currentMode.fill} height="460" width="400" />

            {/* Satellite Depth Variation Contours */}
            {isSatellite && (
              <g>
                <path
                  d="M0,315 Q80,350 185,355 Q275,345 318,270 Q328,175 348,80 L400,72 L400,460 L0,460 Z"
                  fill="#0f4c5c"
                  fillOpacity="0.42"
                />
                <path
                  d="M0,255 Q115,305 225,292 Q295,255 312,165 Q322,105 345,55 L400,55 L400,460 L0,460 Z"
                  fill="#083344"
                  fillOpacity="0.36"
                />
                <ellipse cx="165" cy="145" rx="135" ry="95" fill="url(#satFosse)" />
                <path
                  d="M5,305 Q100,342 205,335 T318,225"
                  fill="none"
                  stroke="#64dfdf"
                  strokeOpacity="0.38"
                  strokeWidth="1"
                />
                <text className="font-mono text-[8px]" fill="#64dfdf" opacity="0.85" x="22" y="300">
                  -10m Plateau Stora
                </text>
                <path
                  d="M12,140 Q145,180 250,150 T330,45"
                  fill="none"
                  stroke="#00f2fe"
                  strokeDasharray="2 4"
                  strokeOpacity="0.45"
                  strokeWidth="1.1"
                />
                <text className="font-mono text-[8px]" fill="#00f2fe" opacity="0.85" x="108" y="148">
                  -50m Fosse Skikda
                </text>
              </g>
            )}

            {currentMode.showGrid && (
              <g opacity="0.14" stroke="#40dcca" strokeWidth="0.6">
                <line x1="0" y1="115" x2="400" y2="115" />
                <line x1="0" y1="230" x2="400" y2="230" />
                <line x1="0" y1="345" x2="400" y2="345" />
                <line x1="100" y1="0" x2="100" y2="460" />
                <line x1="200" y1="0" x2="200" y2="460" />
                <line x1="300" y1="0" x2="300" y2="460" />
              </g>
            )}

            {/* Coastline: Stora -> Port de Skikda -> Cap de Fer */}
            <path
              d="M0,335 Q45,355 68,365 Q105,395 160,398 Q240,400 295,365 Q335,320 330,220 Q325,130 355,66 L400,72 L400,460 L0,460 Z"
              fill={isSatellite ? '#1c2a24' : '#131e2b'}
              fillOpacity={isSatellite ? '0.95' : '0.92'}
              stroke={isSatellite ? '#4f6d5a' : '#3a494b'}
              strokeWidth="1.5"
            />
            <text className="font-mono text-[9px]" fill="#b9cacb" x="24" y="382">
              STORA
            </text>
            <text className="font-mono text-[9px]" fill="#b9cacb" x="122" y="422">
              PORT DE SKIKDA
            </text>
            <text className="font-mono text-[9px]" fill="#ffd491" x="305" y="55">
              CAP DE FER
            </text>

            {/* Isobaths */}
            <g>
              <path
                d="M15,280 Q110,320 215,310 T310,190"
                fill="none"
                stroke="#00c0ae"
                strokeDasharray="3 3"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              />
              <text className="font-mono text-[9px]" fill="#00c0ae" opacity="0.8" x="35" y="276">
                20m
              </text>
              <path
                d="M20,195 Q150,235 240,210 T320,90"
                fill="none"
                stroke="#00f2fe"
                strokeOpacity="0.45"
                strokeWidth="1.2"
              />
              <text className="font-mono text-[9px]" fill="#00f2fe" opacity="0.85" x="170" y="204">
                40m ({activeZone.label})
              </text>
            </g>

            {/* Cap de Fer Sensitive Zone Geofence */}
            {geofence.enabled && (
              <g transform={`translate(${geofencePos.x.toFixed(1)}, ${geofencePos.y.toFixed(1)})`}>
                <circle
                  cx="0"
                  cy="0"
                  r={geofenceSvgRadius}
                  fill="#ffb4ab"
                  fillOpacity="0.1"
                  stroke="#ffb4ab"
                  strokeDasharray="5 3"
                  strokeWidth="1.5"
                />
                <circle cx="0" cy="0" r="3" fill="#ffb4ab" />
                <text
                  x={-geofenceSvgRadius - 10}
                  y={geofenceSvgRadius + 12}
                  fill="#ffb4ab"
                  className="font-mono text-[8px] font-bold"
                >
                  GEOFENCE {geofence.radius_m}m
                </text>
              </g>
            )}

            {/* Dynamic GNSS-shifted Sensor Layer */}
            <g transform={gnssDriftTransform} className="transition-transform duration-500">
              {/* Recorded visionia_memoire GNSS Track */}
              {trackMemoire.length > 1 && (
                <polyline
                  points={trackPointsSvg}
                  fill="none"
                  stroke="#40dcca"
                  strokeOpacity="0.65"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Ollama /scan_area Bathymetric Scan Perimeter */}
              {activeScanArea && (
                <g transform={`translate(${scanPos.x.toFixed(1)}, ${scanPos.y.toFixed(1)})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r={scanSvgRadius}
                    fill="#00f2fe"
                    fillOpacity="0.09"
                    stroke="#00f2fe"
                    strokeDasharray="4 3"
                    strokeWidth="1.4"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r={Math.round(scanSvgRadius * 0.55)}
                    fill="none"
                    stroke="#40dcca"
                    strokeOpacity="0.45"
                    strokeWidth="0.9"
                  />
                  <text
                    x={-scanSvgRadius}
                    y={-scanSvgRadius - 5}
                    fill="#00f2fe"
                    className="font-mono text-[8px] font-bold"
                  >
                    SCAN IA {activeScanArea.radiusM}m · {activeScanArea.label}
                  </text>
                </g>
              )}

              {/* Vessel Track */}
              <path
                d="M78,345 Q105,315 135,285"
                fill="none"
                opacity="0.75"
                stroke="#00f2fe"
                strokeDasharray="4 6"
                strokeLinecap="round"
                strokeWidth="2.5"
              />

              {/* Sonar Beam Cone */}
              {!aiTransitSleep && (
                <g transform="rotate(42 135 285)">
                  <path
                    d="M135,285 L70,130 A155,155 0 0,1 200,130 Z"
                    fill="url(#depthGradient)"
                    opacity="0.82"
                  />
                </g>
              )}

              {/* Dynamic map_overlay Waypoints & Saved Place Pins */}
              <g>
                {waypoints
                  .filter((wp) => (wp.zoneId || 'skikda') === activeZone.id)
                  .map((wp) => {
                  if (wp.category === 'fish' && !fishVisible) return null;
                  const { x, y } = projectLatLonToSvg(wp.lat, wp.lon, activeZone);
                  const isActive = wp.id === activeWaypointId;
                  const isSavedPin = savedPlaces.some((p) => p.waypointId === wp.id);
                  let color = '#40dcca';
                  if (wp.category === 'fish') color = '#ffba38';
                  else if (wp.category === 'wreck') color = '#00f2fe';
                  else if (wp.category === 'restricted') color = '#ffb4ab';

                  return (
                    <g
                      key={wp.id}
                      transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!measureActive) {
                          onSelectWaypoint(wp.id);
                        }
                      }}
                    >
                      {isActive && (
                        <circle
                          cx="0"
                          cy="0"
                          r="13"
                          stroke="#00f2fe"
                          strokeDasharray="3 3"
                          strokeWidth="1.2"
                          opacity="0.9"
                        />
                      )}
                      {isSavedPin ? (
                        <g transform="translate(0, -2)">
                          <path
                            d="M0,-14 C-4.5,-14 -8,-10.5 -8,-6 C-8,-1 0,6 0,6 C0,6 8,-1 8,-6 C8,-10.5 4.5,-14 0,-14 Z"
                            fill={color}
                            stroke="#04101c"
                            strokeWidth="1.4"
                          />
                          <circle cx="0" cy="-6" r="2.6" fill="#04101c" />
                          <text x="10" y="-4" fill="#e0fdff" className="font-sans text-[8.5px] font-bold">
                            {wp.name}
                          </text>
                        </g>
                      ) : (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r={wp.category === 'fish' ? 6 : 4.5}
                            fill={color}
                            fillOpacity="0.32"
                          />
                          <circle cx="0" cy="0" r="2.8" fill={color} />
                          <text x="8" y="3" fill={color} className="font-mono text-[8px] font-bold">
                            {wp.name}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Own Vessel */}
              <g transform="translate(135, 285) rotate(42)">
                <line
                  stroke="#00f2fe"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="-40"
                />
                <circle cx="0" cy="-40" fill="#00f2fe" r="2.5" />
                <polygon
                  fill="#00f2fe"
                  points="0,-13 8,11 0,6 -8,11"
                  stroke="#002022"
                  strokeWidth="1.5"
                />
                <circle cx="0" cy="0" fill="#ffffff" r="3" />
              </g>
            </g>

            {/* Distance Ruler Overlay */}
            {measureActive && measurePoints.length > 0 && (
              <g>
                <line
                  x1={measurePoints[0].x}
                  y1={measurePoints[0].y}
                  x2={(measurePoints[1] ?? measurePoints[0]).x}
                  y2={(measurePoints[1] ?? measurePoints[0]).y}
                  stroke="#00f2fe"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                <circle cx={measurePoints[0].x} cy={measurePoints[0].y} r="4.5" fill="#00f2fe" />
                {measurePoints[1] && (
                  <circle cx={measurePoints[1].x} cy={measurePoints[1].y} r="4.5" fill="#ffba38" />
                )}
              </g>
            )}
          </svg>

          {/* Left Badges */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
            {measureActive && (
              <div className="bg-[#080f18]/90 border border-[#00f2fe]/50 px-3 py-1.5 rounded-lg font-mono text-xs text-[#00f2fe]">
                {measureLabel}
              </div>
            )}
            {isSatellite && (
              <div className="bg-[#080f18]/85 border border-[#40dcca]/40 px-2.5 py-1 rounded-lg font-mono text-[11px] text-[#40dcca]">
                Satellite Bathy · Variations 10m–50m
              </div>
            )}
            {geofence.enabled && (
              <div className="bg-[#080f18]/85 border border-[#ffb4ab]/45 px-2.5 py-1 rounded-lg font-mono text-[11px] text-[#ffb4ab] flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>
                  Geofence {geofence.zone_name} ({geofence.radius_m}m)
                </span>
              </div>
            )}
            {!gnssNmea.antenna_clear_sky && (
              <div className="bg-[#93000a]/80 border border-[#ffb4ab]/60 px-2.5 py-1 rounded-lg font-mono text-[11px] text-[#ffb4ab]">
                Antenne GNSS obstruée · Précision dégradée
              </div>
            )}
          </div>

          {/* Map Controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => {
                const next = (mapModeIdx + 1) % MAP_MODES.length;
                setMapModeIdx(next);
                onNotify(`Calque carte : ${MAP_MODES[next].name}`);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#19202a]/90 hover:bg-[#232a34] border border-[#3a494b] text-xs font-medium text-[#e0fdff] whitespace-nowrap"
            >
              <Layers className="w-4 h-4 text-[#40dcca]" />
              <span>{currentMode.name}</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={onToggleFishVisible}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap ${
                    fishVisible
                      ? 'bg-[#19202a]/90 border-[#40dcca]/50 text-[#e0fdff]'
                      : 'bg-[#151c25]/90 border-[#3a494b] text-[#9eb2b8]'
                  }`}
                >
                  <Fish className="w-4 h-4 text-[#ffba38]" />
                  <span>Poissons IA {fishVisible ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleAiTransitSleep}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap ${
                    aiTransitSleep
                      ? 'bg-[#ffba38]/20 border-[#ffba38]/60 text-[#ffd491]'
                      : 'bg-[#19202a]/90 border-[#3a494b] text-[#9eb2b8] hover:text-[#e0fdff]'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{aiTransitSleep ? 'IA Veille (Transit)' : 'IA Active'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setMeasureActive((prev) => !prev);
                setMeasurePoints([]);
              }}
              aria-label="Règle de distance navale"
              className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                measureActive
                  ? 'bg-[#00f2fe] border-[#00f2fe] text-[#002022]'
                  : 'bg-[#19202a]/90 border-[#3a494b] text-[#e0fdff] hover:bg-[#232a34]'
              }`}
            >
              <Ruler className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNotify(`Carte recentrée sur ${activeZone.label}`)}
              aria-label="Recentrer sur mon navire"
              className="w-10 h-10 rounded-lg bg-[#19202a]/90 hover:bg-[#232a34] border border-[#3a494b] flex items-center justify-center text-[#00f2fe]"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="px-2.5 py-1 rounded bg-[#080f18]/85 border border-[#3a494b]/50 font-mono text-[11px] text-[#9eb2b8]">
              {activeZone.label} · {activeZone.subtitle}
            </div>
            <button
              type="button"
              onClick={onSaveCurrentPosition}
              disabled={isCapturingPosition}
              className="pointer-events-auto px-4 py-2.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] disabled:opacity-70 text-[#002022] text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-[#00f2fe]/25 transition-colors whitespace-nowrap"
            >
              <MapPin className="w-4 h-4" />
              <span>
                {isCapturingPosition ? 'Capture GPS...' : 'Enregistrer ma position'}
              </span>
            </button>
          </div>
        </section>

        {/* CHIRP DualScan Echogram */}
        <section className="lg:col-span-5 rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#19202a] border border-[#3a494b]/60 flex items-center justify-center text-[#40dcca]">
                <Waves className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#e0fdff]">Sonar CHIRP DualScan</h2>
                <p className="text-xs font-mono text-[#9eb2b8]">
                  200 kHz · {aiTransitSleep ? 'IA en veille (économie)' : 'Détection active'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-mono text-[#40dcca]">Profondeur</div>
              <div className="text-2xl font-mono font-bold text-[#e0fdff] tabular-nums">
                {telemetry.chirpDepth.toFixed(1)} <span className="text-xs text-[#9eb2b8]">m</span>
              </div>
            </div>
          </div>

          <div className="relative w-full h-44 bg-[#040910] rounded-lg overflow-hidden border border-[#3a494b]/50">
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="absolute left-2 inset-y-2 flex flex-col justify-between pointer-events-none font-mono text-[10px] text-[#9eb2b8]">
              <span>0 m</span>
              <span className="text-[#40dcca]">16 m · TH</span>
              <span>30 m</span>
              <span className="text-[#e0fdff] font-semibold">42 m</span>
            </div>
            <div className="absolute right-2 top-[32%] bg-[#080f18]/85 px-2 py-0.5 rounded font-mono text-[10px] text-[#40dcca] border border-[#40dcca]/30 pointer-events-none">
              Thermocline 16.2 m (ΔT -3.4°C)
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2
                className={`w-5 h-5 shrink-0 ${
                  aiTransitSleep ? 'text-[#ffba38]' : 'text-[#40dcca]'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-mono text-[#40dcca]">
                  {aiTransitSleep
                    ? 'IA en veille · Ressources préservées'
                    : `IA Sonar Vision · ${scanResult.conf}`}
                </div>
                <div className="text-sm text-[#e0fdff] truncate">
                  {aiTransitSleep
                    ? 'Réactivez IA Active pour générer des waypoints'
                    : scanResult.species}
                </div>
              </div>
            </div>
            <span className="font-mono text-xs text-[#00f2fe] bg-[#080f18] px-2 py-1 rounded shrink-0">
              {scanResult.zone}
            </span>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCreateWaypoint}
                className="h-11 px-4 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#3a494b] text-[#e0fdff] text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
              >
                <MapPinPlus className="w-4 h-4 text-[#40dcca]" />
                <span>Créer Waypoint</span>
              </button>
              <button
                type="button"
                onClick={() => setScanResult(onScanAreaOllama(scanRadiusM))}
                className="h-11 px-4 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
              >
                <Cpu className="w-4 h-4" />
                <span>Scan IA ({scanRadiusM}m)</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
