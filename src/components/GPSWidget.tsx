import React from 'react';
import {
  Activity,
  Cpu,
  FileCode2,
  FileSpreadsheet,
  LocateFixed,
  MapPin,
  Satellite,
  Timer,
} from 'lucide-react';
import { useGNSSStream } from '../hooks/useGNSSStream';
import { MarineGpsTrackerConfig, TelemetryState } from '../types/marine';
import { VESSEL_LAT, VESSEL_LON } from '../utils/navigation';

interface GPSWidgetProps {
  tracker: MarineGpsTrackerConfig;
  telemetry: TelemetryState;
  autoLogCountdownSec: number;
  showTechDetails?: boolean;
  isAdmin?: boolean;
  isCapturingPosition?: boolean;
  onSaveCurrentPosition: () => void;
  onEnableHardwareHook: () => void;
  onConfigureAutoLog: () => void;
  onExportSetupJson: () => void;
  onExportXlsx: () => void;
}

export const GPSWidget: React.FC<GPSWidgetProps> = ({
  tracker,
  telemetry,
  autoLogCountdownSec,
  showTechDetails = false,
  isAdmin = true,
  isCapturingPosition = false,
  onSaveCurrentPosition,
  onEnableHardwareHook,
  onConfigureAutoLog,
  onExportSetupJson,
  onExportXlsx,
}) => {
  const effectiveTech = isAdmin && showTechDetails;
  const { latestFrame, bufferCount, isStreaming } = useGNSSStream({
    enabled: tracker.enabled,
    sensorId: tracker.sensor_id,
    hardwareHookActive: tracker.hardware_hook_active,
    frequencyHz: tracker.frequency_hz,
    bufferSize: tracker.buffer_size,
    baseLat: VESSEL_LAT,
    baseLon: VESSEL_LON,
    sog: telemetry.sog,
    cog: telemetry.cog,
    depthM: telemetry.chirpDepth,
    gnssSynced: telemetry.gnssSynced,
  });

  const bufferPct = Math.min(100, Math.round((bufferCount / tracker.buffer_size) * 100));

  return (
    <section
      id="gps-widget-panel"
      className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#19202a] border border-[#00f2fe]/40 flex items-center justify-center text-[#00f2fe]">
            <Satellite className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#e0fdff]">
                {effectiveTech ? `GPSWidget · Flux ${tracker.sensor_id}` : 'Position GPS'}
              </h3>
              <span
                className={`text-xs font-mono font-semibold ${
                  isStreaming ? 'text-[#40dcca]' : 'text-[#ffba38]'
                }`}
              >
                {isStreaming
                  ? effectiveTech
                    ? `${tracker.sampling_rate} Actif`
                    : 'Fix Actif'
                  : 'En attente'}
              </span>
            </div>
            {effectiveTech && (
              <p className="text-xs font-mono text-[#9eb2b8]">
                Hook React useGNSSStream · MARINE_GPS_TRACKER · Buffer {bufferCount}/
                {tracker.buffer_size}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSaveCurrentPosition}
            disabled={isCapturingPosition}
            className="px-4 py-2 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] disabled:opacity-70 text-[#002022] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#00f2fe]/15 transition-colors whitespace-nowrap"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {isCapturingPosition ? 'Capture GPS...' : 'Enregistrer ma position'}
            </span>
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onEnableHardwareHook}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  tracker.hardware_hook_active
                    ? 'bg-[#40dcca] text-[#002022]'
                    : 'bg-[#232a34] hover:bg-[#2e353f] border border-[#3a494b] text-[#e0fdff]'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>
                  {tracker.hardware_hook_active
                    ? effectiveTech
                      ? 'GNSS_L5 Activé'
                      : 'Capteur GPS Actif'
                    : effectiveTech
                      ? '/system_hook --enable_sensor "GNSS_L5"'
                      : 'Activer Capteur GPS'}
                </span>
              </button>

              <button
                type="button"
                onClick={onConfigureAutoLog}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  tracker.auto_log_excel
                    ? 'bg-[#19202a] border border-[#40dcca]/50 text-[#40dcca]'
                    : 'bg-[#232a34] hover:bg-[#2e353f] border border-[#3a494b] text-[#e0fdff]'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                <span>
                  {tracker.auto_log_excel
                    ? `Auto-Log ${tracker.auto_log_interval_sec}s (${autoLogCountdownSec}s)`
                    : effectiveTech
                      ? 'Activer /set_auto_log'
                      : 'Auto-Log Excel'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live Telemetry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40">
          <div className="text-xs text-[#9eb2b8]">
            {effectiveTech ? `Position Live (${tracker.sampling_rate})` : 'Coordonnées'}
          </div>
          <div className="text-base font-mono font-bold text-[#e0fdff] mt-1 tabular-nums">
            {latestFrame.lat.toFixed(5)}°N
          </div>
          <div className="text-base font-mono font-bold text-[#00f2fe] tabular-nums">
            {latestFrame.lon.toFixed(5)}°E
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40">
          <div className="text-xs text-[#9eb2b8]">Précision &amp; Vitesse</div>
          <div className="text-xl font-mono font-bold text-[#40dcca] mt-1 tabular-nums">
            ±{latestFrame.accuracyM.toFixed(1)} m
          </div>
          <div className="text-sm font-mono font-semibold text-[#e0fdff] mt-0.5 tabular-nums">
            <span className="text-[#00f2fe] font-bold">{latestFrame.sog.toFixed(1)} kts</span> ·{' '}
            {String(latestFrame.cog).padStart(3, '0')}°
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40">
          <div className="text-xs text-[#9eb2b8]">Sonde Bathymétrie</div>
          <div className="text-2xl font-mono font-bold text-[#ffba38] mt-1 tabular-nums">
            {latestFrame.depthM.toFixed(1)} m
          </div>
          {effectiveTech && (
            <div className="text-[11px] font-mono text-[#9eb2b8] truncate mt-0.5">
              Offset quille {tracker.bathymetry_depth_offset_m}m
            </div>
          )}
        </div>

        {effectiveTech && (
          <div className="p-3.5 rounded-lg bg-[#19202a] border border-[#3a494b]/40">
            <div className="text-xs font-mono text-[#9eb2b8]">Tampon Flux GNSS</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-mono font-bold text-[#e0fdff] tabular-nums">
                {bufferCount} / {tracker.buffer_size}
              </span>
              <span className="text-[11px] font-mono text-[#40dcca]">{latestFrame.timestamp}</span>
            </div>
            <div className="w-full h-1.5 bg-[#080f18] rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-[#00f2fe] rounded-full transition-all duration-300"
                style={{ width: `${bufferPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Technical Footer Quick Actions (hidden in streamlined sea mode unless toggled & admin) */}
      {effectiveTech && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#3a494b]/40 text-xs">
          <div className="flex items-center gap-2 font-mono text-[#9eb2b8]">
            <Activity className="w-3.5 h-3.5 text-[#40dcca]" />
            <span>
              Cible Excel : <strong className="text-[#e0fdff]">{tracker.target_file}</strong> ·{' '}
              Cycle {tracker.auto_log_interval_sec}s
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportSetupJson}
              className="px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#3a494b] text-[#e0fdff] text-xs font-medium flex items-center gap-1.5"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#00f2fe]" />
              <span>setup_marine_gps.json</span>
            </button>
            <button
              type="button"
              onClick={onExportXlsx}
              className="px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#40dcca]/40 text-[#40dcca] text-xs font-medium flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exporter {tracker.target_file}</span>
            </button>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[#40dcca]">
              <LocateFixed className="w-3 h-3" />
              {tracker.sensor_id}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
