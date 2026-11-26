import React, { useMemo, useState } from 'react';
import { Copy, Download, FileJson, MapPinPlus } from 'lucide-react';
import { McpPointSummary, NavigationZoneId, WaypointCategory } from '../types/marine';
import { NAVIGATION_ZONES, getNavigationZone } from '../utils/navigation';

interface GpsJsonWriterPanelProps {
  activeZoneId: NavigationZoneId;
  pointsNavigation: McpPointSummary[];
  adminToken?: string | null;
  onAddManualPoint: (input: {
    name: string;
    lat: number;
    lon: number;
    depth: number;
    category: WaypointCategory;
    zoneId: NavigationZoneId;
  }) => void;
  onNotify: (msg: string) => void;
  onLog: (tag: string, source: string, detail: string) => void;
}

export const GpsJsonWriterPanel: React.FC<GpsJsonWriterPanelProps> = ({
  activeZoneId,
  pointsNavigation,
  adminToken = null,
  onAddManualPoint,
  onNotify,
  onLog,
}) => {
  const initialZone = getNavigationZone(activeZoneId);
  const [name, setName] = useState('');
  const [latStr, setLatStr] = useState(initialZone.centerLat.toFixed(4));
  const [lonStr, setLonStr] = useState(initialZone.centerLon.toFixed(4));
  const [depthStr, setDepthStr] = useState('24');
  const [zoneId, setZoneId] = useState<NavigationZoneId>(activeZoneId);
  const [category, setCategory] = useState<WaypointCategory>('anchor');
  const [noteStr, setNoteStr] = useState('');
  const [notesByName, setNotesByName] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const jsonPayload = useMemo(
    () => ({
      schema: 'marinevision.data_points/v1',
      storage_target: 'visionia_memoire',
      file: 'data_points.json',
      updated_at: new Date().toISOString().slice(0, 16) + 'Z',
      total_points: pointsNavigation.length,
      points: pointsNavigation.map((p) => ({
        nom: p.name,
        region: getNavigationZone(activeZoneId).label,
        lat: p.lat,
        lon: p.long,
        note: notesByName[p.name.toLowerCase()] || `Sonde ${p.depth} m · ${p.type}`,
      })),
      points_gps: pointsNavigation.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        long: p.long,
        gps: p.gps || { lat: p.lat, lon: p.long, datum: 'WGS84' },
        depth: p.depth,
        type: p.type,
      })),
    }),
    [pointsNavigation, activeZoneId, notesByName]
  );

  const formattedJson = useMemo(() => JSON.stringify(jsonPayload, null, 2), [jsonPayload]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(latStr.replace(',', '.'));
    const parsedLon = parseFloat(lonStr.replace(',', '.'));
    const parsedDepth = parseFloat(depthStr.replace(',', '.'));

    if (!name.trim()) {
      setFormError('Saisissez un nom pour le point GPS personnalisé.');
      return;
    }
    if (Number.isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setFormError('Latitude invalide (attendue entre -90 et 90).');
      return;
    }
    if (Number.isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
      setFormError('Longitude invalide (attendue entre -180 et 180).');
      return;
    }

    const trimmedName = name.trim();
    const cleanNote = noteStr.trim() || `Sonde ${Number.isNaN(parsedDepth) || parsedDepth <= 0 ? 24 : parsedDepth} m · ${category}`;

    onAddManualPoint({
      name: trimmedName,
      lat: parsedLat,
      lon: parsedLon,
      depth: Number.isNaN(parsedDepth) || parsedDepth <= 0 ? 24 : parsedDepth,
      category,
      zoneId,
    });

    setNotesByName((prev) => ({
      ...prev,
      [trimmedName.toLowerCase()]: cleanNote,
    }));

    if (adminToken) {
      void fetch('/api/data-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          point: {
            nom: trimmedName,
            region: getNavigationZone(zoneId).label,
            lat: parsedLat,
            lon: parsedLon,
            note: cleanNote,
          },
        }),
      }).catch(() => {
        // offline fallback handled in localStorage
      });
    }

    setName('');
    setNoteStr('');
    setFormError(null);
    onLog(
      'DATA POINTS',
      'data_points.json',
      `Point GPS « ${trimmedName} » (${parsedLat.toFixed(4)}, ${parsedLon.toFixed(4)}) persisté`
    );
  };

  const handleDownloadJson = () => {
    const dataPointsDoc = {
      schema: 'marinevision.data_points/v1',
      app: 'MarineVision AI',
      storage: 'visionia_memoire',
      updated_at: new Date().toISOString(),
      points: jsonPayload.points,
    };
    const blob = new Blob([JSON.stringify(dataPointsDoc, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data_points.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onLog(
      'EXPORT JSON',
      'data_points.json',
      `${pointsNavigation.length} point(s) exporté(s) (nom, region, lat, lon, note)`
    );
    onNotify('data_points.json téléchargé');
  };

  return (
    <section
      id="gps-json-writer-panel"
      className="rounded-xl bg-[#151c25] border border-[#40dcca]/40 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-[#40dcca]" />
          <h3 className="text-base font-semibold text-[#e0fdff]">
            Points GPS Personnalisés &amp; Écriture JSON (<code className="text-[#00f2fe]">visionia_memoire</code>)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[#40dcca] tabular-nums">
          {pointsNavigation.length} pts · WGS84 lat/long
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <div className="p-2.5 rounded-lg bg-[#93000a]/30 border border-[#ffb4ab]/40 text-xs text-[#ffb4ab]">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="gps-writer-name" className="block text-[11px] font-medium text-[#9eb2b8] mb-1">
              Nom du point d&apos;intérêt
            </label>
            <input
              id="gps-writer-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormError(null);
              }}
              placeholder="Ex : Passe Srigina, Mouillage Cap..."
              className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs text-[#e0fdff] placeholder-[#849495] focus:outline-none focus:border-[#00f2fe]"
            />
          </div>
          <div>
            <label htmlFor="gps-writer-zone" className="block text-[11px] font-medium text-[#9eb2b8] mb-1">
              Secteur Méditerranée
            </label>
            <select
              id="gps-writer-zone"
              value={zoneId}
              onChange={(e) => {
                const next = e.target.value as NavigationZoneId;
                setZoneId(next);
                const z = getNavigationZone(next);
                setLatStr(z.centerLat.toFixed(4));
                setLonStr(z.centerLon.toFixed(4));
              }}
              className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs text-[#e0fdff] focus:outline-none focus:border-[#00f2fe]"
            >
              {NAVIGATION_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label htmlFor="gps-writer-lat" className="block text-[11px] font-medium text-[#9eb2b8] mb-1">
              Latitude (lat)
            </label>
            <input
              id="gps-writer-lat"
              type="text"
              inputMode="decimal"
              value={latStr}
              onChange={(e) => {
                setLatStr(e.target.value);
                setFormError(null);
              }}
              className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs font-mono text-[#00f2fe] focus:outline-none focus:border-[#00f2fe]"
            />
          </div>
          <div>
            <label htmlFor="gps-writer-lon" className="block text-[11px] font-medium text-[#9eb2b8] mb-1">
              Longitude (long)
            </label>
            <input
              id="gps-writer-lon"
              type="text"
              inputMode="decimal"
              value={lonStr}
              onChange={(e) => {
                setLonStr(e.target.value);
                setFormError(null);
              }}
              className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs font-mono text-[#00f2fe] focus:outline-none focus:border-[#00f2fe]"
            />
          </div>
          <div>
            <label htmlFor="gps-writer-depth" className="block text-[11px] font-medium text-[#9eb2b8] mb-1">
              Sonde (m)
            </label>
            <input
              id="gps-writer-depth"
              type="number"
              min={1}
              max={2000}
              value={depthStr}
              onChange={(e) => setDepthStr(e.target.value)}
              className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs font-mono text-[#e0fdff] focus:outline-none focus:border-[#00f2fe]"
            />
          </div>
          <div>
            <label htmlFor="gps-writer-cat" className="block text-[11px] font-medium text-[#9eb2b8] mb-1">
              Type
            </label>
            <select
              id="gps-writer-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as WaypointCategory)}
              className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs text-[#e0fdff] focus:outline-none focus:border-[#00f2fe]"
            >
              <option value="anchor">Mouillage</option>
              <option value="fish">Pêche</option>
              <option value="wreck">Épave</option>
              <option value="restricted">Danger</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="gps-writer-note" className="block text-[11px] font-medium text-[#9eb2b8] mb-1">
            Note / Observation (champ note dans data_points.json)
          </label>
          <input
            id="gps-writer-note"
            type="text"
            value={noteStr}
            onChange={(e) => setNoteStr(e.target.value)}
            placeholder="Ex : Mouillage abrité, fond sableux 14 m..."
            className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs text-[#e0fdff] placeholder-[#849495] focus:outline-none focus:border-[#00f2fe]"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <MapPinPlus className="w-4 h-4" />
          <span>Enregistrer dans data_points.json &amp; visionia_memoire</span>
        </button>
      </form>

      <div className="bg-[#080f18] border border-[#3a494b]/60 rounded-lg p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#3a494b]/40">
          <span className="text-[11px] font-mono text-[#9eb2b8]">
            Aperçu JSON : data_points.json (nom, region, lat, lon, note)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(formattedJson);
                onNotify('Schéma JSON Points GPS copié');
              }}
              className="px-2 py-1 rounded bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b] text-[11px] font-mono text-[#40dcca] flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              <span>Copier</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-2 py-1 rounded bg-[#40dcca] hover:bg-[#6ff6ff] text-[#002022] text-[11px] font-bold flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Exporter .json</span>
            </button>
          </div>
        </div>
        <pre className="text-[11px] font-mono text-[#dce3f0] leading-relaxed max-h-48 overflow-y-auto overflow-x-auto select-all">
          {formattedJson}
        </pre>
      </div>
    </section>
  );
};
