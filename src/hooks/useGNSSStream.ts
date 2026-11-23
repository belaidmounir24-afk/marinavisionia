import { useEffect, useState } from 'react';

export interface GnssStreamFrame {
  id: number;
  timestamp: string;
  sensorId: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  depthM: number;
  accuracyM: number;
  samplingRate: string;
}

interface UseGNSSStreamOptions {
  enabled: boolean;
  sensorId: string;
  hardwareHookActive: boolean;
  frequencyHz: number;
  bufferSize: number;
  baseLat: number;
  baseLon: number;
  sog: number;
  cog: number;
  depthM: number;
  gnssSynced: boolean;
}

export function useGNSSStream({
  enabled,
  sensorId,
  hardwareHookActive,
  frequencyHz,
  bufferSize,
  baseLat,
  baseLon,
  sog,
  cog,
  depthM,
  gnssSynced,
}: UseGNSSStreamOptions) {
  const [frames, setFrames] = useState<GnssStreamFrame[]>(() => [
    {
      id: 1,
      timestamp: new Date().toTimeString().split(' ')[0],
      sensorId,
      lat: baseLat,
      lon: baseLon,
      sog,
      cog,
      depthM,
      accuracyM: hardwareHookActive ? (gnssSynced ? 0.4 : 1.1) : 6.4,
      samplingRate: `${frequencyHz}Hz`,
    },
  ]);

  useEffect(() => {
    if (!enabled || !hardwareHookActive) return;

    const intervalMs = Math.max(250, Math.round(1000 / Math.max(1, frequencyHz)));
    const timer = window.setInterval(() => {
      setFrames((prev) => {
        const nextId = (prev[0]?.id || 0) + 1;
        const jitterLat = (Math.sin(nextId * 0.4) * 0.00018);
        const jitterLon = (Math.cos(nextId * 0.4) * 0.00022);
        const frame: GnssStreamFrame = {
          id: nextId,
          timestamp: new Date().toTimeString().split(' ')[0],
          sensorId,
          lat: +(baseLat + jitterLat).toFixed(5),
          lon: +(baseLon + jitterLon).toFixed(5),
          sog,
          cog,
          depthM,
          accuracyM: gnssSynced ? 0.4 : 1.1,
          samplingRate: `${frequencyHz}Hz`,
        };
        return [frame, ...prev].slice(0, Math.max(1, bufferSize));
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    enabled,
    hardwareHookActive,
    sensorId,
    frequencyHz,
    bufferSize,
    baseLat,
    baseLon,
    sog,
    cog,
    depthM,
    gnssSynced,
  ]);

  return {
    latestFrame: frames[0],
    buffer: frames,
    bufferCount: frames.length,
    isStreaming: enabled && hardwareHookActive,
  };
}
