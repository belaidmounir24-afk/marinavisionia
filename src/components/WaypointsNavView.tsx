import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  Code2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Globe,
  History,
  Info,
  LocateFixed,
  MapPin,
  MapPinPlus,
  Navigation,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { NavigationZoneId, SavedPlaceRecord, Waypoint, WaypointCategory } from '../types/marine';
import {
  calculateGpsDistance,
  getNavigationZone,
  MANUAL_POINT_TOOLTIP,
  NAVIGATION_ZONES,
  VESSEL_LAT,
  VESSEL_LON,
} from '../utils/navigation';

interface WaypointsNavViewProps {
  waypoints: Waypoint[];
  savedPlaces: SavedPlaceRecord[];
  activeWaypointId: string;
  activeZoneId: NavigationZoneId;
  isAdmin?: boolean;
  isCapturingPosition?: boolean;
  onChangeZone: (zoneId: NavigationZoneId) => void;
  onSaveCurrentPosition: () => void;
  onOpenManualPoint: () => void;
  onViewOnMap: (id: string) => void;
  onActivateWaypoint: (id: string) => void;
  onEditWaypoint: (wp: Waypoint) => void;
  onInspectWaypoint: (wp: Waypoint) => void;
  onImportFile: (file: File) => void;
  onExtractJson: () => void;
  onDownloadSampleCsv: () => void;
  onShowImportHistory: () => void;
  onExport: (fmt: 'XLSX' | 'JSON' | 'PDF') => void;
}

const FILTER_TABS: Array<{ id: 'all' | WaypointCategory; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'fish', label: 'Bancs de poissons' },
  { id: 'wreck', label: 'Épaves & Structures' },
  { id: 'anchor', label: 'Mouillages' },
  { id: 'restricted', label: 'Zones réglementées' },
];

export const WaypointsNavView: React.FC<WaypointsNavViewProps> = ({
  waypoints,
  savedPlaces,
  activeWaypointId,
  activeZoneId,
  isAdmin = true,
  isCapturingPosition = false,
  onChangeZone,
  onSaveCurrentPosition,
  onOpenManualPoint,
  onViewOnMap,
  onActivateWaypoint,
  onEditWaypoint,
  onInspectWaypoint,
  onImportFile,
  onExtractJson,
  onDownloadSampleCsv,
  onShowImportHistory,
  onExport,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | WaypointCategory>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [showCoords, setShowCoords] = useState(false);
  const [showAllZones, setShowAllZones] = useState(false);
  const [originMode, setOriginMode] = useState<'gps' | 'free'>('gps');
  const [gpsOriginLat, setGpsOriginLat] = useState(VESSEL_LAT);
  const [gpsOriginLon, setGpsOriginLon] = useState(VESSEL_LON);
  const [freeLatInput, setFreeLatInput] = useState(VESSEL_LAT.toFixed(4));
  const [freeLonInput, setFreeLonInput] = useState(VESSEL_LON.toFixed(4));

  const activeZone = useMemo(() => getNavigationZone(activeZoneId), [activeZoneId]);

  const effectiveOrigin = useMemo(() => {
    if (originMode === 'free') {
      const pLat = parseFloat(freeLatInput.replace(',', '.'));
      const pLon = parseFloat(freeLonInput.replace(',', '.'));
      if (!Number.isNaN(pLat) && !Number.isNaN(pLon)) {
        return { lat: pLat, lon: pLon };
      }
    }
    return { lat: gpsOriginLat, lon: gpsOriginLon };
  }, [originMode, freeLatInput, freeLonInput, gpsOriginLat, gpsOriginLon]);

  const zoneWaypoints = useMemo(() => {
    const base = showAllZones || activeZoneId === 'mediterranee'
      ? waypoints
      : waypoints.filter((w) => (w.zoneId || 'skikda') === activeZoneId);
    return base.map((wp) => {
      const vec = calculateGpsDistance(effectiveOrigin.lat, effectiveOrigin.lon, wp.lat, wp.lon);
      return {
        ...wp,
        dynamicNm: vec.distanceNm,
        dynamicKm: vec.distanceKm,
        dynamicBearing: vec.bearingDeg,
      };
    });
  }, [waypoints, activeZoneId, showAllZones, effectiveOrigin]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: zoneWaypoints.length,
      fish: 0,
      wreck: 0,
      anchor: 0,
      restricted: 0,
    };
    zoneWaypoints.forEach((w) => {
      map[w.category] = (map[w.category] || 0) + 1;
    });
    return map;
  }, [zoneWaypoints]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return zoneWaypoints
      .filter((wp) => {
        const catOk = filter === 'all' || wp.category === filter;
        const textOk =
          !q ||
          [wp.id, wp.name, wp.coords, wp.metaValue2, wp.rawType, String(wp.depthM)].some((s) =>
            String(s || '').toLowerCase().includes(q)
          );
        return catOk && textOk;
      })
      .sort((a, b) => (sortAsc ? a.dynamicNm - b.dynamicNm : b.dynamicNm - a.dynamicNm));
  }, [zoneWaypoints, filter, search, sortAsc]);

  const handleUseBrowserGpsOrigin = () => {
    setOriginMode('gps');
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsOriginLat(+pos.coords.latitude.toFixed(4));
          setGpsOriginLon(+pos.coords.longitude.toFixed(4));
        },
        () => {
          setGpsOriginLat(activeZone.centerLat);
          setGpsOriginLon(activeZone.centerLon);
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }
  };

  const aiCount = useMemo(() => zoneWaypoints.filter((w) => w.aiDetected).length, [zoneWaypoints]);
  const manualCount = useMemo(() => zoneWaypoints.filter((w) => w.isManual).length, [zoneWaypoints]);

  return (
    <div className="space-y-6">
      {/* Header Summary Strip with Dynamic Region Selector */}
      <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold text-[#e0fdff]">Lieux &amp; Navigation</h2>
            <span className="text-[#3a494b]" aria-hidden="true">
              ·
            </span>
            <div className="relative inline-flex items-center">
              <Globe className="w-3.5 h-3.5 text-[#00f2fe] absolute left-2.5 pointer-events-none" />
              <label htmlFor="navigation-zone-select" className="sr-only">
                Zone de navigation active
              </label>
              <select
                id="navigation-zone-select"
                value={activeZoneId}
                onChange={(e) => onChangeZone(e.target.value as NavigationZoneId)}
                className="appearance-none bg-[#080f18] hover:bg-[#19202a] border border-[#00f2fe]/50 rounded-lg pl-8 pr-8 py-1.5 text-sm font-semibold text-[#00f2fe] focus:outline-none focus:ring-2 focus:ring-[#00f2fe] cursor-pointer transition-colors"
              >
                {NAVIGATION_ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id} className="bg-[#080f18] text-[#e0fdff]">
                    {zone.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#00f2fe] absolute right-2.5 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setShowAllZones((v) => !v)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                showAllZones
                  ? 'bg-[#232a34] border-[#40dcca]/60 text-[#40dcca]'
                  : 'bg-[#080f18] border-[#3a494b]/60 text-[#9eb2b8] hover:text-[#e0fdff]'
              }`}
            >
              {showAllZones ? 'Toutes zones' : activeZone.subtitle}
            </button>
          </div>
          <p className="text-xs font-mono text-[#9eb2b8] tabular-nums">
            {zoneWaypoints.length} épingles affichées · {savedPlaces.length} GPS auto · {manualCount}{' '}
            manuel(s) · {aiCount} zones IA
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSaveCurrentPosition}
            disabled={isCapturingPosition}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] disabled:opacity-70 text-[#002022] text-xs font-bold shadow-md shadow-[#00f2fe]/15 whitespace-nowrap transition-colors"
          >
            <MapPin className="w-4 h-4" />
            <span>
              {isCapturingPosition ? 'Capture GPS...' : 'Enregistrer ma position'}
            </span>
          </button>

          {/* Manual Point Button with Accessible Tooltip (Infobulle) */}
          <div className="relative group inline-flex items-center">
            <button
              type="button"
              onClick={onOpenManualPoint}
              title={MANUAL_POINT_TOOLTIP}
              aria-describedby="manual-point-tooltip"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/60 text-[#40dcca] text-xs font-semibold whitespace-nowrap transition-colors"
            >
              <MapPinPlus className="w-4 h-4" />
              <span>Ajouter point manuel</span>
              <Info className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
            </button>
            <div
              id="manual-point-tooltip"
              role="tooltip"
              className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] z-40 rounded-xl bg-[#080f18] border border-[#40dcca]/60 p-3 shadow-2xl text-[11px] leading-relaxed text-[#dce3f0]"
            >
              <span className="block font-semibold text-[#40dcca] mb-0.5">
                Saisie manuelle (Nom, Lat, Lon)
              </span>
              {MANUAL_POINT_TOOLTIP}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCoords((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 text-xs font-medium text-[#9eb2b8] hover:text-[#e0fdff] whitespace-nowrap"
          >
            {showCoords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showCoords ? 'Masquer chiffres' : 'Afficher lat/lon'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSortAsc((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 text-xs font-medium text-[#40dcca] whitespace-nowrap"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Distance {sortAsc ? '↑' : '↓'}</span>
          </button>
        </div>
      </div>

      {/* Top 2-Column Workspace: Left Import/Export Controls, Right Waypoint List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Quick Pin Capture + Manual Entry + CSV/GPX Import + Export */}
        <div className="lg:col-span-4 space-y-5">
          {/* One-Click Geolocation Capture Card */}
          <section className="rounded-xl bg-[#151c25] border border-[#00f2fe]/35 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#00f2fe]" />
              <h3 className="text-base font-semibold text-[#e0fdff]">Capture GPS Sans Saisie</h3>
            </div>
            <p className="text-xs text-[#9eb2b8] leading-relaxed">
              Capturez automatiquement votre position actuelle et nommez le lieu pour l&apos;épingler directement sur la carte, ou saisissez des coordonnées manuellement.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onSaveCurrentPosition}
                disabled={isCapturingPosition}
                className="w-full py-2.5 px-4 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] disabled:opacity-70 text-[#002022] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>
                  {isCapturingPosition ? 'Localisation en cours...' : 'Enregistrer ce lieu'}
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenManualPoint}
                title={MANUAL_POINT_TOOLTIP}
                className="w-full py-2 px-4 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/45 text-[#40dcca] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <MapPinPlus className="w-4 h-4" />
                <span>Ajouter point manuel</span>
              </button>
            </div>
          </section>

          {/* Import CSV Module (Admin only) */}
          {isAdmin && (
            <section className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#e0fdff]">Import skikda_points.csv</h3>
                <p className="text-xs font-mono text-[#40dcca] mt-0.5">
                  Colonnes : name, lat, long, depth, type
                </p>
              </div>
              <p className="text-xs text-[#9eb2b8] leading-relaxed">
                Importez vos waypoints CSV ou GPX autour de Stora et du Cap de Fer, puis convertissez-les vers{' '}
                <code className="font-mono text-[#00f2fe]">visionia_optimization.json</code>.
              </p>

              <div className="flex flex-col gap-2.5">
                <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Importer CSV / GPX</span>
                  <input
                    type="file"
                    accept=".csv,.gpx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImportFile(file);
                      e.target.value = '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={onExtractJson}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/40 text-[#00f2fe] text-xs font-semibold transition-colors"
                >
                  <Code2 className="w-4 h-4" />
                  <span>Extraire JSON</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#3a494b]/40 text-xs">
                <button
                  type="button"
                  onClick={onDownloadSampleCsv}
                  className="flex items-center gap-1 text-[#40dcca] hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Modèle skikda_points.csv</span>
                </button>
                <button
                  type="button"
                  onClick={onShowImportHistory}
                  className="flex items-center gap-1 text-[#9eb2b8] hover:text-[#e0fdff]"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Historique</span>
                </button>
              </div>
            </section>
          )}

          {/* Export Validated Data */}
          <section className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-5 space-y-3">
            <h3 className="text-base font-semibold text-[#e0fdff]">Export des données validées</h3>
            <button
              type="button"
              onClick={() => onExport('XLSX')}
              className="w-full p-3.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/30 flex items-center gap-3 text-left transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5 text-[#40dcca] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#e0fdff]">
                  Export Excel (donnees_visionia.xlsx)
                </div>
                <div className="text-[11px] text-[#9eb2b8] truncate">
                  Sauvegarde structurée des waypoints
                </div>
              </div>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onExport('JSON')}
                className="w-full p-3.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/50 flex items-center gap-3 text-left transition-colors"
              >
                <Code2 className="w-5 h-5 text-[#00f2fe] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#e0fdff]">Export JSON</div>
                  <div className="text-[11px] text-[#9eb2b8] truncate">
                    visionia_optimization.json
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => onExport('PDF')}
              className="w-full p-3.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/50 flex items-center gap-3 text-left transition-colors"
            >
              <FileText className="w-5 h-5 text-[#ffb4ab] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#e0fdff]">Export PDF de Mission</div>
                <div className="text-[11px] text-[#9eb2b8] truncate">
                  Rapport bathymétrie &amp; relevés
                </div>
              </div>
            </button>
          </section>
        </div>

        {/* Right Main Column: Dynamic GPS Distance Reference + Search, Filter Bar, Waypoint Cards */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <LocateFixed className="w-4 h-4 text-[#00f2fe] shrink-0" />
              <div>
                <span className="font-semibold text-[#e0fdff]">Distance GPS dynamique (Haversine)</span>
                <span className="block text-[11px] font-mono text-[#9eb2b8] tabular-nums">
                  Origine : {effectiveOrigin.lat.toFixed(4)}° N, {effectiveOrigin.lon.toFixed(4)}° E
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseBrowserGpsOrigin}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  originMode === 'gps'
                    ? 'bg-[#00f2fe] border-[#00f2fe] text-[#002022]'
                    : 'bg-[#080f18] border-[#3a494b] text-[#9eb2b8]'
                }`}
              >
                GPS Actuel
              </button>
              <button
                type="button"
                onClick={() => setOriginMode('free')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  originMode === 'free'
                    ? 'bg-[#40dcca] border-[#40dcca] text-[#002022]'
                    : 'bg-[#080f18] border-[#3a494b] text-[#9eb2b8]'
                }`}
              >
                Coordonnées libres
              </button>
              {originMode === 'free' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label="Latitude de référence libre"
                    value={freeLatInput}
                    onChange={(e) => setFreeLatInput(e.target.value)}
                    placeholder="Lat"
                    className="w-20 bg-[#080f18] border border-[#40dcca]/60 rounded px-2 py-1 text-[11px] font-mono text-[#00f2fe]"
                  />
                  <input
                    type="text"
                    aria-label="Longitude de référence libre"
                    value={freeLonInput}
                    onChange={(e) => setFreeLonInput(e.target.value)}
                    placeholder="Lon"
                    className="w-20 bg-[#080f18] border border-[#40dcca]/60 rounded px-2 py-1 text-[11px] font-mono text-[#00f2fe]"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#9eb2b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher Stora, Cap de Fer, profondeur, type..."
              className="w-full bg-[#080f18] border border-[#3a494b]/60 rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#e0fdff] placeholder-[#849495] focus:outline-none focus:border-[#00f2fe]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9eb2b8] hover:text-[#e0fdff]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {FILTER_TABS.map((tab) => {
              const isSelected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[#00f2fe] text-[#002022] font-semibold'
                      : 'bg-[#151c25] text-[#9eb2b8] hover:text-[#e0fdff] border border-[#3a494b]/50'
                  }`}
                >
                  {tab.label} ({counts[tab.id] || 0})
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-8 text-center">
              <p className="text-sm font-semibold text-[#e0fdff]">Aucun waypoint correspondant</p>
              <p className="text-xs text-[#9eb2b8] mt-1">
                Modifiez votre recherche ou importez un fichier skikda_points.csv.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((wp) => {
                const isActive = wp.id === activeWaypointId;
                const savedPlace = savedPlaces.find((p) => p.waypointId === wp.id);
                return (
                  <article
                    key={wp.id}
                    className={`rounded-xl p-4 flex flex-col justify-between gap-3 border transition-colors ${
                      isActive
                        ? 'bg-[#19202a] border-[#00f2fe]/60'
                        : 'bg-[#151c25] border-[#3a494b]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[#40dcca]">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-[#00f2fe]" />
                          <span className="font-bold">
                            {wp.isManual ? 'Point Manuel' : savedPlace ? 'Épingle GPS' : wp.badge}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{isActive ? 'Route active' : wp.id}</span>
                          {showAllZones && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#9eb2b8]">
                                {getNavigationZone(wp.zoneId).label}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-[#e0fdff] mt-1 truncate">
                          {wp.name}
                        </h3>
                        {showCoords ? (
                          <p className="text-xs font-mono text-[#9eb2b8] mt-0.5 tabular-nums">
                            {wp.coords}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onViewOnMap(wp.id)}
                            className="text-xs text-[#40dcca] hover:underline mt-0.5 inline-flex items-center gap-1"
                          >
                            <span>Épinglé sur la carte</span>
                          </button>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-mono font-bold text-[#00f2fe] tabular-nums">
                          {wp.dynamicNm.toFixed(1)}{' '}
                          <span className="text-xs font-semibold text-[#40dcca]">NM</span>
                        </div>
                        <div className="text-xs font-mono text-[#9eb2b8] tabular-nums">
                          {wp.dynamicKm.toFixed(1)} km · Cap {wp.dynamicBearing}°
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#3a494b]/40 text-xs">
                      <div>
                        <span className="text-[#9eb2b8] block">{wp.metaLabel1}</span>
                        <span className="font-mono font-semibold text-[#e0fdff] tabular-nums">
                          {wp.metaValue1}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#9eb2b8] block">{wp.metaLabel2}</span>
                        <span
                          className={`font-medium ${
                            wp.category === 'restricted' ? 'text-[#ffb4ab]' : 'text-[#40dcca]'
                          }`}
                        >
                          {wp.metaValue2}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onActivateWaypoint(wp.id)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                          isActive
                            ? 'bg-[#00f2fe] text-[#002022]'
                            : 'bg-[#232a34] hover:bg-[#2e353f] text-[#e0fdff]'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>{isActive ? 'Cap Engagé' : 'Naviguer vers'}</span>
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onEditWaypoint(wp)}
                          className="py-2 px-3 rounded-lg bg-[#232a34] hover:bg-[#2e353f] text-xs text-[#dce3f0] flex items-center gap-1 whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Éditer</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onInspectWaypoint(wp)}
                        className="py-2 px-3 rounded-lg bg-[#232a34] hover:bg-[#2e353f] text-xs text-[#00f2fe] flex items-center gap-1 whitespace-nowrap"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Détails</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
