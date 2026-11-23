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
  onSelectPlan: (tier: SubscriptionTier) => void;
  onNotify: (msg: string) => void;
}

interface DeviceOrientationWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const AIS_TARGETS_SKIKDA = [
  { mmsi: '605012440', name: 'EL-KALA II (Chalutier)', dist: '1.8 NM', cog: '048°', sog: '6.2 kts' },
  { mmsi: '605089112', name: 'STORA PILOT 01', dist: '2.4 NM', cog: '312°', sog: '11.4 kts' },
];

export const CompassGpsCard: React.FC<CompassGpsCardProps> = ({
  telemetry,
  toolsConfig,
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
    onNotify('Capteurs natifs Compas (DeviceOrientationEvent) + GPS activés');
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
              <h3 className="text-base font-semibold text-[#e0fdff]">Compas Magnétique + GPS</h3>
              <span className="text-[11px] font-mono text-[#00f2fe]">
                {getTierLabel(toolsConfig.active_plan)}
              </span>
            </div>
            <p className="text-xs font-mono text-[#9eb2b8]">
              API : {toolsConfig.sensors_api.compass} · {toolsConfig.sensors_api.geolocation}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleNativeSensors}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
            nativeActive
              ? 'bg-[#40dcca] text-[#002022]'
              : 'bg-[#232a34] hover:bg-[#2e353f] border border-[#3a494b] text-[#e0fdff]'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{nativeActive ? 'Capteurs Natifs Actifs' : 'Activer Capteurs Natifs'}</span>
        </button>
      </div>

      {!compassAccess ? (
        <div className="p-4 rounded-lg bg-[#080f18] border border-[#ffb4ab]/40 text-xs text-[#ffb4ab]">
          Module Compas + GPS désactivé par `marine_tools_config.json`.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Animated Compass Dial */}
          <div className="md:col-span-4 flex items-center gap-4 p-3 rounded-lg bg-[#080f18] border border-[#3a494b]/50">
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
              <div className="text-[11px] font-mono text-[#9eb2b8]">Cap Magnétique</div>
              <div className="text-2xl font-mono font-bold text-[#e0fdff] tabular-nums">
                {String(compassDeg).padStart(3, '0')}°{' '}
                <span className="text-sm text-[#40dcca]">{getCardinal(compassDeg)}</span>
              </div>
              <div className="text-[10px] font-mono text-[#9eb2b8] mt-1">{sensorSource}</div>
            </div>
          </div>

          {/* Native GPS Position */}
          <div className="md:col-span-3 p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 space-y-1.5">
            <div className="text-[11px] font-mono text-[#9eb2b8]">GPS Position</div>
            <div className="text-sm font-mono font-semibold text-[#e0fdff] tabular-nums">
              {gpsCoords.lat.toFixed(4)}° N
            </div>
            <div className="text-sm font-mono font-semibold text-[#00f2fe] tabular-nums">
              {gpsCoords.lon.toFixed(4)}° E
            </div>
            <div className="text-[11px] font-mono text-[#40dcca] tabular-nums">
              Précision ±{gpsCoords.acc} m
            </div>
          </div>

          {/* AISStream Premium Gated Module via hasAccess('ais_stream') */}
          <div className="md:col-span-5 p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e0fdff]">
                <Radio className="w-3.5 h-3.5 text-[#00f2fe]" />
                <span>AISStream · Trafic Maritime</span>
              </div>
              {aisAccess ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#40dcca]">
                  <Unlock className="w-3 h-3" />
                  <span>Premium Actif</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#ffba38]">
                  <Lock className="w-3 h-3" />
                  <span>Verrouillé (Free)</span>
                </span>
              )}
            </div>

            {aisAccess ? (
              <div className="space-y-1.5">
                {AIS_TARGETS_SKIKDA.map((t) => (
                  <div
                    key={t.mmsi}
                    className="flex items-center justify-between text-[11px] font-mono bg-[#080f18] px-2.5 py-1.5 rounded border border-[#3a494b]/40"
                  >
                    <span className="text-[#e0fdff] truncate">{t.name}</span>
                    <span className="text-[#40dcca] shrink-0 tabular-nums">
                      {t.dist} · {t.sog}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#080f18] border border-[#ffba38]/30 rounded p-2.5 space-y-2">
                <div className="text-[11px] text-[#9eb2b8]">
                  <code className="text-[#ffba38]">hasAccess(&apos;ais_stream&apos;) = false</code> ·
                  Les cibles AISStream sont réservées aux plans Premium.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectPlan('yearly')}
                    className="px-2.5 py-1 rounded bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-[11px] font-semibold flex items-center gap-1"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>Passer Yearly (12.99 EUR)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPlan('one_time')}
                    className="px-2.5 py-1 rounded bg-[#232a34] hover:bg-[#2e353f] text-[#e0fdff] text-[11px] font-medium"
                  >
                    One Time (41.99 EUR)
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
