import React, { useEffect, useState } from 'react';
import {
  Compass,
  Lock,
  Navigation,
  Radio,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { MarineToolsConfig, SubscriptionTier, TelemetryState } from '../types/marine';
import { getTierLabel, hasAccess } from '../utils/accessControl';
import { getCardinal, VESSEL_LAT, VESSEL_LON } from '../utils/navigation';

interface CompassGpsCardProps {
  telemetry: TelemetryState;
  toolsConfig: MarineToolsConfig;
  showTechDetails?: boolean;
  onSelectPlan: (tier: SubscriptionTier) => void;
  onNotify: (msg: string) => void;
}

interface DeviceOrientationWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const AIS_TARGETS_SKIKDA = [
  {
    mmsi: '605012440',
    name: 'EL-KALA II',
    vesselType: 'Chalutier',
    distNm: '1.8',
    cog: '048°',
    sogKts: '6.2',
    proximity: 'close' as const,
  },
  {
    mmsi: '605089112',
    name: 'STORA PILOT 01',
    vesselType: 'Pilote',
    distNm: '2.4',
    cog: '312°',
    sogKts: '11.4',
    proximity: 'nominal' as const,
  },
];

export const CompassGpsCard: React.FC<CompassGpsCardProps> = ({
  telemetry,
  toolsConfig,
  showTechDetails = false,
  onSelectPlan,
  onNotify,
}) => {
  const [nativeActive, setNativeActive] = useState(false);
  const [compassDeg, setCompassDeg] = useState<number>(telemetry.cog);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number; acc: number }>({
    lat: VESSEL_LAT,
    lon: VESSEL_LON,
    acc: telemetry.gnssOffsetM,
  });
  const [sensorSource, setSensorSource] = useState<'GNSS Simulé' | 'DeviceOrientationEvent + GPS'>(
    'GNSS Simulé'
  );

  // Sync simulated heading & coordinates when native browser sensors are not actively overriding
  useEffect(() => {
    if (!nativeActive) {
      setCompassDeg(telemetry.cog);
      setGpsCoords({
        lat: VESSEL_LAT,
        lon: VESSEL_LON,
        acc: telemetry.gnssOffsetM,
      });
      setSensorSource('GNSS Simulé');
    }
  }, [nativeActive, telemetry.cog, telemetry.gnssOffsetM]);

  useEffect(() => {
    if (!nativeActive) return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      const webkitHeading = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof webkitHeading === 'number' && !Number.isNaN(webkitHeading)) {
        setCompassDeg(Math.round(webkitHeading));
        setSensorSource('DeviceOrientationEvent + GPS');
      } else if (typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
        setCompassDeg(Math.round((360 - e.alpha) % 360));
        setSensorSource('DeviceOrientationEvent + GPS');
      }
    };

    window.addEventListener('deviceorientation', onOrientation);

    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsCoords({
            lat: +pos.coords.latitude.toFixed(5),
            lon: +pos.coords.longitude.toFixed(5),
            acc: Math.round(pos.coords.accuracy || 5),
          });
          setSensorSource('DeviceOrientationEvent + GPS');
        },
        () => {
          // Graceful fallback in desktop/iframe environments
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 5000 }
      );
    }

    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [nativeActive]);

  const handleToggleNativeSensors = async () => {
    if (nativeActive) {
      setNativeActive(false);
      onNotify('Capteurs Compas + GPS revenus en mode GNSS Skikda');
      return;
    }

    try {
      const devOrient = window.DeviceOrientationEvent as unknown as
        | DeviceOrientationWithPermission
        | undefined;
      if (devOrient && typeof devOrient.requestPermission === 'function') {
        const res = await devOrient.requestPermission();
        if (res !== 'granted') {
          onNotify('Autorisation DeviceOrientationEvent refusée');
          return;
        }
      }
    } catch {
      // Proceed cleanly on non-iOS browsers
    }

    setNativeActive(true);
    onNotify('Capteurs natifs Compas + GPS activés');
  };

  const compassAccess = hasAccess('compass_gps', toolsConfig);
  const aisAccess = hasAccess('ais_stream', toolsConfig);

  return (
    <section
      id="compass-gps-panel"
      className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#19202a] border border-[#40dcca]/40 flex items-center justify-center text-[#40dcca]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#e0fdff]">Cap Magnétique &amp; Position GPS</h3>
              {showTechDetails && (
                <span className="text-xs font-mono text-[#00f2fe]">
                  {getTierLabel(toolsConfig.active_plan)}
                </span>
              )}
            </div>
            {showTechDetails && (
              <p className="text-xs font-mono text-[#9eb2b8]">
                API : {toolsConfig.sensors_api.compass} · {toolsConfig.sensors_api.geolocation}
              </p>
            )}
          </div>
        </div>

        {/* High-visibility Solid Primary CTA Button */}
        <button
          type="button"
          onClick={handleToggleNativeSensors}
          className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-md ${
            nativeActive
              ? 'bg-[#40dcca] hover:bg-[#5cecd9] text-[#002022] shadow-[#40dcca]/20'
              : 'bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] shadow-[#00f2fe]/20'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>{nativeActive ? 'Capteurs Natifs Actifs' : 'Activer Capteurs Natifs'}</span>
        </button>
      </div>

      {!compassAccess ? (
        <div className="p-4 rounded-lg bg-[#080f18] border border-[#ffb4ab]/40 text-xs text-[#ffb4ab]">
          Module Compas + GPS désactivé dans les paramètres.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Animated Compass Dial */}
          <div className="md:col-span-4 flex items-center gap-4 p-3.5 rounded-lg bg-[#080f18] border border-[#3a494b]/50">
            <svg className="w-20 h-20 shrink-0" viewBox="0 0 100 100" aria-label="Rose des vents">
              <circle cx="50" cy="50" r="44" stroke="#3a494b" strokeWidth="1.5" fill="#0d141d" />
              <circle
                cx="50"
                cy="50"
                r="36"
                stroke="#40dcca"
                strokeOpacity="0.3"
                strokeDasharray="2 3"
                strokeWidth="1"
              />
              <text x="47" y="16" fill="#00f2fe" className="font-mono text-[9px] font-bold">
                N
              </text>
              <text x="83" y="53" fill="#9eb2b8" className="font-mono text-[8px]">
                E
              </text>
              <text x="47" y="90" fill="#9eb2b8" className="font-mono text-[8px]">
                S
              </text>
              <text x="11" y="53" fill="#9eb2b8" className="font-mono text-[8px]">
                W
              </text>
              <g transform={`rotate(${compassDeg} 50 50)`} className="transition-transform duration-300">
                <polygon points="50,18 55,50 50,45 45,50" fill="#00f2fe" />
                <polygon points="50,82 54,50 50,55 46,50" fill="#ffb4ab" opacity="0.7" />
                <circle cx="50" cy="50" r="3.5" fill="#e0fdff" />
              </g>
            </svg>
            <div>
              <div className="text-xs text-[#9eb2b8]">Cap Magnétique</div>
              <div className="text-3xl font-mono font-bold text-[#00f2fe] tabular-nums mt-0.5">
                {String(compassDeg).padStart(3, '0')}°{' '}
                <span className="text-base text-[#40dcca]">{getCardinal(compassDeg)}</span>
              </div>
              {showTechDetails && (
                <div className="text-[10px] font-mono text-[#9eb2b8] mt-1">{sensorSource}</div>
              )}
            </div>
          </div>

          {/* Native GPS Position */}
          <div className="md:col-span-3 p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 flex flex-col justify-center space-y-1">
            <div className="text-xs text-[#9eb2b8]">Position GPS</div>
            <div className="text-base font-mono font-bold text-[#e0fdff] tabular-nums">
              {gpsCoords.lat.toFixed(4)}° N
            </div>
            <div className="text-base font-mono font-bold text-[#00f2fe] tabular-nums">
              {gpsCoords.lon.toFixed(4)}° E
            </div>
            <div className="text-xs font-mono font-semibold text-[#40dcca] tabular-nums pt-0.5">
              Précision ±{gpsCoords.acc} m
            </div>
          </div>

          {/* AISStream Premium Gated Module */}
          <div className="md:col-span-5 p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e0fdff]">
                <Radio className="w-3.5 h-3.5 text-[#00f2fe]" />
                <span>AISStream · Trafic Proche</span>
              </div>
              {aisAccess ? (
                <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#40dcca]">
                  <Unlock className="w-3 h-3" />
                  <span>Actif</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#ffba38]">
                  <Lock className="w-3 h-3" />
                  <span>Premium</span>
                </span>
              )}
            </div>

            {aisAccess ? (
              <div className="space-y-2">
                {AIS_TARGETS_SKIKDA.map((t) => (
                  <div
                    key={t.mmsi}
                    className="flex items-center justify-between gap-3 bg-[#080f18] px-3 py-2 rounded-lg border border-[#3a494b]/40"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#e0fdff] truncate">
                        {t.name}
                      </div>
                      <div className="text-[11px] text-[#9eb2b8] truncate">
                        {t.vesselType}
                        {showTechDetails ? ` · MMSI ${t.mmsi} · Cap ${t.cog}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-baseline gap-2.5">
                      <span
                        className={`text-base sm:text-lg font-mono font-bold tabular-nums px-2 py-0.5 rounded ${
                          t.proximity === 'close'
                            ? 'bg-[#ffba38]/15 text-[#ffba38]'
                            : 'bg-[#00f2fe]/15 text-[#00f2fe]'
                        }`}
                      >
                        {t.distNm} <span className="text-xs font-semibold">NM</span>
                      </span>
                      <span className="text-sm font-mono font-bold text-[#40dcca] tabular-nums">
                        {t.sogKts} <span className="text-[11px] font-normal">kts</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#080f18] border border-[#ffba38]/30 rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#9eb2b8] truncate">
                    {showTechDetails
                      ? "hasAccess('ais_stream') = false · Verrouillé Free"
                      : 'EL-KALA II · STORA PILOT 01 (Verrouillé)'}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#ffba38] shrink-0 tabular-nums">
                    1.8 NM · 2.4 NM
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectPlan('monthly')}
                    className="px-3 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Débloquer 1 mois (20 €)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPlan('annual')}
                    className="px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] text-[#e0fdff] text-xs font-medium"
                  >
                    1 an (100 €)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
