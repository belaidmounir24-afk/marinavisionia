import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Code2,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Navigation,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Waypoint, WaypointCategory } from '../types/marine';

interface WaypointsNavViewProps {
  waypoints: Waypoint[];
  activeWaypointId: string;
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
  activeWaypointId,
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

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: waypoints.length,
      fish: 0,
      wreck: 0,
      anchor: 0,
      restricted: 0,
    };
    waypoints.forEach((w) => {
      map[w.category] = (map[w.category] || 0) + 1;
    });
    return map;
  }, [waypoints]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return waypoints
      .filter((wp) => {
        const catOk = filter === 'all' || wp.category === filter;
        const textOk =
          !q ||
          [wp.id, wp.name, wp.coords, wp.metaValue2, wp.rawType, String(wp.depthM)].some((s) =>
            String(s || '').toLowerCase().includes(q)
          );
        return catOk && textOk;
      })
      .sort((a, b) => (sortAsc ? a.distanceNm - b.distanceNm : b.distanceNm - a.distanceNm));
  }, [waypoints, filter, search, sortAsc]);

  const aiCount = useMemo(() => waypoints.filter((w) => w.aiDetected).length, [waypoints]);

  return (
    <div className="space-y-6">
      {/* Header Summary Strip */}
      <div className="rounded-xl bg-[#151c25] border border-[#3a494b]/50 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#e0fdff]">Waypoints &amp; Navigation · Golfe de Skikda</h2>
          <p className="text-xs font-mono text-[#9eb2b8] mt-0.5 tabular-nums">
            {waypoints.length} points actifs · {aiCount} zones poissonneuses IA · Position 36°56.10&apos;N 006°57.30&apos;E
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSortAsc((s) => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/60 text-xs font-medium text-[#40dcca] whitespace-nowrap"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Tri : Distance {sortAsc ? '↑' : '↓'}</span>
        </button>
      </div>

      {/* Top 2-Column Workspace: Left Import/Export Controls, Right Waypoint List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: CSV/GPX Import + Extract JSON + Export */}
        <div className="lg:col-span-4 space-y-5">
          {/* Import CSV Module */}
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
                  Sauvegarde structurée des waypoints Skikda
                </div>
              </div>
            </button>

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

            <button
              type="button"
              onClick={() => onExport('PDF')}
              className="w-full p-3.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b]/50 flex items-center gap-3 text-left transition-colors"
            >
              <FileText className="w-5 h-5 text-[#ffb4ab] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#e0fdff]">Export PDF de Mission</div>
                <div className="text-[11px] text-[#9eb2b8] truncate">
                  Rapport bathymétrie &amp; relevés IA
                </div>
              </div>
            </button>
          </section>
        </div>

        {/* Right Main Column: Search, Filter Bar, Waypoint Cards */}
        <div className="lg:col-span-8 space-y-4">
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
                        <div className="flex items-center gap-2 text-xs font-mono text-[#40dcca]">
                          <span className="font-bold">{wp.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{isActive ? 'Route active' : wp.badge}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#9eb2b8]">{wp.rawType}</span>
                        </div>
                        <h3 className="text-base font-semibold text-[#e0fdff] mt-1 truncate">
                          {wp.name}
                        </h3>
                        <p className="text-xs font-mono text-[#9eb2b8] mt-0.5 tabular-nums">
                          {wp.coords}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-bold text-[#00f2fe] tabular-nums">
                          {wp.distanceNm.toFixed(1)} NM
                        </div>
                        <div className="text-xs font-mono text-[#9eb2b8] tabular-nums">
                          Cap {wp.bearing}°
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
                      <button
                        type="button"
                        onClick={() => onEditWaypoint(wp)}
                        className="py-2 px-3 rounded-lg bg-[#232a34] hover:bg-[#2e353f] text-xs text-[#dce3f0] flex items-center gap-1 whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Éditer</span>
                      </button>
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
