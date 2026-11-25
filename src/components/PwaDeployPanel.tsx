import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  GitBranch,
  Globe,
  LocateFixed,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  VideoOff,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall, useServiceWorkerStatus } from '../hooks/usePWAInstall';
import { PwaDeployConfig } from '../types/marine';

interface PwaDeployPanelProps {
  pwaDeploy: PwaDeployConfig;
  onUpdatePwaDeploy: (patch: Partial<PwaDeployConfig>) => void;
  onSyncNetlify: () => void;
  onExportNetlifyToml: () => void;
  onNotify: (msg: string) => void;
  onLog: (tag: string, source: string, detail: string) => void;
}

export const PwaDeployPanel: React.FC<PwaDeployPanelProps> = ({
  pwaDeploy,
  onUpdatePwaDeploy,
  onSyncNetlify,
  onExportNetlifyToml,
  onNotify,
  onLog,
}) => {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { swState, lastCheckTime, updateFoundCount, forceUpdateCheck } = useServiceWorkerStatus();

  const [geoStatus, setGeoStatus] = useState<'idle' | 'granted' | 'denied' | 'testing'>('idle');
  const [geoCoords, setGeoCoords] = useState<string | null>(null);
  const [camStatus, setCamStatus] = useState<'idle' | 'active' | 'denied' | 'unavailable'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamStatus((prev) => (prev === 'active' ? 'idle' : prev));
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleTestGeo = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('denied');
      onNotify('Geolocation non supportée sur ce navigateur');
      return;
    }
    setGeoStatus('testing');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E (±${Math.round(pos.coords.accuracy)} m)`;
        setGeoCoords(coords);
        setGeoStatus('granted');
        onLog('PERMISSION GPS', 'geolocation', `Autorisation accordée : ${coords}`);
        onNotify(`GPS vérifié : ${coords}`);
      },
      (err) => {
        setGeoStatus('denied');
        onLog('PERMISSION GPS', 'geolocation', `Accès restreint ou simulé (${err.message})`);
        onNotify('GPS : autorisation refusée ou mode simulé Skikda actif');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleToggleCamera = async () => {
    if (camStatus === 'active') {
      stopCamera();
      onNotify('Flux caméra arrêté');
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCamStatus('unavailable');
      onNotify('API Caméra indisponible dans cet environnement');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCamStatus('active');
      onLog('PERMISSION CAM', 'camera', 'Permissions-Policy camera=(self) active · flux vidéo prêt');
      onNotify('Caméra pont / vision marine activée');
    } catch {
      setCamStatus('denied');
      onLog('PERMISSION CAM', 'camera', 'Caméra non détectée ou autorisation refusée');
      onNotify('Caméra non disponible ou autorisation requise');
    }
  };

  const handleForceSwCheck = async () => {
    const res = await forceUpdateCheck();
    onLog(
      'PWA SW',
      '/service-worker.js',
      res.hasUpdate
        ? 'Nouvelle version détectée -> self.skipWaiting() déclenché'
        : `Stratégie ${pwaDeploy.sw_strategy} active · client à jour (${lastCheckTime})`
    );
    onNotify(
      res.hasUpdate
        ? 'Mise à jour Service Worker appliquée (skipWaiting)'
        : 'Service Worker Network-First vérifié et à jour'
    );
  };

  return (
    <section
      id="pwa-deploy-panel"
      className="rounded-xl bg-[#151c25] border border-[#00f2fe]/30 p-5 space-y-4"
    >
      {/* Header with Uploaded Brand Icon */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/1795436584763_98eb2835.jpg"
            alt="Icône PWA MarineVision AI"
            className="w-11 h-11 rounded-xl border border-[#00f2fe]/40 object-cover shrink-0"
          />
          <div>
            <h3 className="text-base font-semibold text-[#e0fdff]">
              Automatisation PWA Android &amp; Netlify CI/CD
            </h3>
            <p className="text-[11px] font-mono text-[#9eb2b8]">
              {pwaDeploy.sw_strategy} · self.skipWaiting() · Anti-Cache HTTP
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border ${
            swState === 'active'
              ? 'bg-[#40dcca]/10 border-[#40dcca]/40 text-[#40dcca]'
              : 'bg-[#19202a] border-[#3a494b] text-[#ffba38]'
          }`}
        >
          {swState === 'active'
            ? `SW Actif (${lastCheckTime})`
            : swState === 'checking'
              ? 'SW Init...'
              : 'SW Standard'}
        </span>
      </div>

      {/* PWA Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-3 rounded-lg bg-[#19202a] border border-[#3a494b]/40 space-y-1">
          <div className="flex items-center gap-1.5 text-[#9eb2b8]">
            <Smartphone className="w-3.5 h-3.5 text-[#00f2fe]" />
            <span>Mode Android</span>
          </div>
          <div className="font-mono font-semibold text-[#e0fdff]">
            {isInstalled ? 'Standalone Installée' : isIOS ? 'Safari iOS' : 'Navigateur Web'}
          </div>
          <div className="text-[10px] font-mono text-[#40dcca]">
            manifest.json · {isOnline ? 'En ligne' : 'Hors ligne'}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#19202a] border border-[#3a494b]/40 space-y-1">
          <div className="flex items-center gap-1.5 text-[#9eb2b8]">
            <RefreshCw className="w-3.5 h-3.5 text-[#40dcca]" />
            <span>Stratégie SW</span>
          </div>
          <div className="font-mono font-semibold text-[#e0fdff]">Network-First</div>
          <div className="text-[10px] font-mono text-[#9eb2b8]">
            skipWaiting + claim · {updateFoundCount} MAJ
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#19202a] border border-[#3a494b]/40 space-y-1">
          <div className="flex items-center gap-1.5 text-[#9eb2b8]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#ffba38]" />
            <span>netlify.toml Headers</span>
          </div>
          <div className="font-mono font-semibold text-[#e0fdff]">no-cache, no-store</div>
          <div className="text-[10px] font-mono text-[#40dcca]">
            Permissions: GPS · Caméra
          </div>
        </div>
      </div>

      {/* Hardware Permissions (geolocation + camera) */}
      <div className="p-3.5 rounded-lg bg-[#19202a] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[#e0fdff]">
            Permissions-Policy Matérielles (Android / Chrome)
          </span>
          <span className="font-mono text-[10px] text-[#40dcca] break-all">
            geolocation=(self), camera=(self)
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTestGeo}
            className="px-3 py-1.5 rounded-lg bg-[#080f18] hover:bg-[#232a34] border border-[#00f2fe]/40 text-xs font-medium text-[#00f2fe] flex items-center gap-1.5"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>
              {geoStatus === 'testing'
                ? 'Acquisition GPS...'
                : geoStatus === 'granted'
                  ? 'GPS Autorisé'
                  : 'Tester Permission GPS'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleCamera}
            className="px-3 py-1.5 rounded-lg bg-[#080f18] hover:bg-[#232a34] border border-[#40dcca]/40 text-xs font-medium text-[#40dcca] flex items-center gap-1.5"
          >
            {camStatus === 'active' ? (
              <VideoOff className="w-3.5 h-3.5 text-[#ffb4ab]" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>{camStatus === 'active' ? 'Arrêter Caméra' : 'Tester Caméra Pont'}</span>
          </button>

          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={install}
              className="px-3 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold flex items-center gap-1.5 ml-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Installer sur Android</span>
            </button>
          )}
        </div>

        {geoCoords && (
          <div className="text-[11px] font-mono text-[#40dcca] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Fix matériel : {geoCoords}</span>
          </div>
        )}

        {camStatus === 'active' && (
          <div className="rounded-lg overflow-hidden border border-[#40dcca]/40 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-40 object-cover"
            />
          </div>
        )}
        {camStatus === 'denied' && (
          <div className="text-[11px] font-mono text-[#ffba38]">
            Autorisez l&apos;accès caméra dans les paramètres Android/Chrome pour l&apos;inspection vidéo.
          </div>
        )}
      </div>

      {/* GitHub -> Netlify CI/CD Sync */}
      <div className="p-3.5 rounded-lg bg-[#19202a] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#e0fdff]">
            <GitBranch className="w-3.5 h-3.5 text-[#00f2fe]" />
            <span>Pipeline GitHub → Netlify (CI/CD Automatique)</span>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-[#9eb2b8] cursor-pointer">
            <input
              type="checkbox"
              checked={pwaDeploy.netlify_auto_publish}
              onChange={(e) => onUpdatePwaDeploy({ netlify_auto_publish: e.target.checked })}
              className="accent-[#40dcca]"
            />
            <span>Auto-publish</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor="github-repo-input" className="block text-[10px] font-mono text-[#9eb2b8] mb-1">
              Dépôt GitHub
            </label>
            <input
              id="github-repo-input"
              type="text"
              value={pwaDeploy.github_repo}
              onChange={(e) => onUpdatePwaDeploy({ github_repo: e.target.value })}
              className="w-full bg-[#080f18] border border-[#3a494b] rounded px-2.5 py-1.5 text-xs font-mono text-[#e0fdff]"
            />
          </div>
          <div>
            <label htmlFor="netlify-site-input" className="block text-[10px] font-mono text-[#9eb2b8] mb-1">
              Cible Netlify ({pwaDeploy.github_branch})
            </label>
            <input
              id="netlify-site-input"
              type="text"
              value={pwaDeploy.netlify_site}
              onChange={(e) => onUpdatePwaDeploy({ netlify_site: e.target.value })}
              className="w-full bg-[#080f18] border border-[#3a494b] rounded px-2.5 py-1.5 text-xs font-mono text-[#40dcca]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleForceSwCheck}
            className="px-3 py-1.5 rounded-lg bg-[#232a34] hover:bg-[#2e353f] border border-[#00f2fe]/40 text-xs font-medium text-[#00f2fe] flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Forcer Vérif. MAJ SW</span>
          </button>
          <button
            type="button"
            onClick={onSyncNetlify}
            className="px-3 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-semibold flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Déployer GitHub → Netlify</span>
          </button>
          <button
            type="button"
            onClick={onExportNetlifyToml}
            className="px-3 py-1.5 rounded-lg bg-[#080f18] hover:bg-[#232a34] border border-[#3a494b] text-xs font-mono text-[#dce3f0] ml-auto"
          >
            netlify.toml
          </button>
        </div>
      </div>
    </section>
  );
};
