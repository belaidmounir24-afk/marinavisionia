import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  analyzeAndSplitAdminPoiCode,
  IntegrationMode,
  SAMPLE_MAIN_JS_SNIPPET,
  SAMPLE_RAW_CODE_SNIPPET,
  SecurizerResult,
} from '../utils/codeSecurizer';

interface CaptureCodePanelProps {
  adminToken: string | null;
  onNotify: (msg: string) => void;
  onLog: (tag: string, source: string, detail: string) => void;
}

type OutputTab = 'client' | 'protection' | 'admin' | 'gps';

export const CaptureCodePanel: React.FC<CaptureCodePanelProps> = ({
  adminToken,
  onNotify,
  onLog,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawCode, setRawCode] = useState<string>('');
  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>('complete');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string>('image/jpeg');
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [result, setResult] = useState<SecurizerResult | null>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>('client');

  const handleSelectPhoto = (file: File | undefined) => {
    if (!file) return;
    setOcrError(null);
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setOcrError('Format non supporté : utilisez une photo JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setOcrError('Photo trop lourde (maximum 10 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreviewUrl(dataUrl);
      setPreviewMime(file.type);
      setPreviewBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRunOcr = async () => {
    if (!previewBase64) {
      setOcrError('Sélectionnez d’abord une photo de votre code.');
      return;
    }
    if (!adminToken) {
      setOcrError('Session Admin requise pour appeler l’OCR serveur.');
      return;
    }

    setIsExtractingOcr(true);
    setOcrError(null);
    try {
      const resp = await fetch('/api/capture-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          mimeType: previewMime,
          imageBase64: previewBase64,
        }),
      });
      const payload = (await resp.json()) as { code?: string; error?: string };
      if (!resp.ok || !payload.code) {
        setOcrError(payload.error || 'Échec de la transcription OCR.');
        onLog('CAPTURE OCR', '/api/capture-ocr', payload.error || 'Erreur OCR');
        return;
      }

      setRawCode(payload.code);
      const split = analyzeAndSplitAdminPoiCode(payload.code, integrationMode);
      setResult(split);
      onLog(
        'CAPTURE OCR',
        '/capture',
        `Code transcrit par OCR (${payload.code.length} car.) + audit main.js (${integrationMode})`
      );
      onNotify('Code extrait par OCR et audité');
    } catch {
      setOcrError('Erreur réseau lors de la communication avec /api/capture-ocr.');
    } finally {
      setIsExtractingOcr(false);
    }
  };

  const handleAnalyzeAndSplit = (modeOverride?: IntegrationMode) => {
    const targetMode = modeOverride || integrationMode;
    if (!rawCode.trim()) {
      setOcrError('Collez votre code (main.js / HTML) ou capturez une photo avant de lancer l’audit.');
      return;
    }
    setOcrError(null);
    const split = analyzeAndSplitAdminPoiCode(rawCode, targetMode);
    setResult(split);
    onLog(
      'AUDIT MAIN.JS',
      '/capture',
      `Audit source (${targetMode === 'complete' ? 'génération complète' : 'intégration progressive'}) · ${split.findings.length} contrôles`
    );
    onNotify(
      targetMode === 'complete'
        ? 'Audit terminé : 4 modules complets générés'
        : 'Audit terminé : patchs d’intégration progressive générés'
    );
  };

  const activeContent = !result
    ? ''
    : outputTab === 'client'
      ? result.clientHtml
      : outputTab === 'protection'
        ? result.protectionScript
        : outputTab === 'admin'
          ? result.adminPoiScript
          : result.gpsJsonWriterScript;

  const isProgressive = (result?.mode || integrationMode) === 'progressive';
  const activeFileName =
    outputTab === 'client'
      ? isProgressive
        ? 'patch-01-nettoyage-main.js'
        : 'client-guest.html'
      : outputTab === 'protection'
        ? isProgressive
          ? 'patch-02-admin-gate.js'
          : 'admin-gate-security.js'
        : outputTab === 'admin'
          ? isProgressive
            ? 'patch-02b-admin-poi-guard.js'
            : 'admin-poi-module.js'
          : isProgressive
            ? 'patch-03-gps-json.js'
            : 'visionia-gps-writer.js';

  const handleDownloadActiveFile = () => {
    if (!activeContent) return;
    const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onNotify(`${activeFileName} téléchargé`);
  };

  return (
    <section
      id="capture-ia-panel"
      className="rounded-xl bg-[#151c25] border border-[#00f2fe]/40 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#00f2fe]" />
          <h3 className="text-base font-semibold text-[#e0fdff]">
            Audit <code className="text-[#40dcca]">main.js</code> &amp; Capture IA (<code className="text-[#40dcca]">/capture</code>)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[#40dcca]">
          Acode · Spck · Node.js · OCR Photo
        </span>
      </div>

      <p className="text-xs text-[#9eb2b8] leading-relaxed">
        Auditez votre fichier <code className="text-[#e0fdff]">main.js</code> (Acode, Spck, Node.js)
        ou capturez une photo de code par OCR pour intégrer le verrouillage par code administrateur,
        la validation JSON GPS (<code className="text-[#e0fdff]">lat/long</code>) et la séparation
        Client / Admin.
      </p>

      {/* Photo Upload / Camera OCR */}
      <div className="p-3.5 rounded-lg bg-[#080f18] border border-[#3a494b]/60 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#e0fdff]">
            1. Capture photo / screenshot (OCR serveur)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => handleSelectPhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#40dcca]/50 text-xs font-medium text-[#40dcca] flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Photo / Fichier</span>
            </button>
            <button
              type="button"
              disabled={!previewBase64 || isExtractingOcr}
              onClick={() => void handleRunOcr()}
              className="px-3 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] disabled:opacity-45 text-[#002022] text-xs font-bold flex items-center gap-1.5"
            >
              {isExtractingOcr ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isExtractingOcr ? 'OCR en cours...' : 'Extraire via OCR'}</span>
            </button>
          </div>
        </div>

        {previewUrl && (
          <div className="flex items-center gap-3 p-2 rounded bg-[#151c25] border border-[#3a494b]/50">
            <img
              src={previewUrl}
              alt="Aperçu code photographié"
              className="w-16 h-16 object-cover rounded border border-[#3a494b]"
            />
            <div className="text-[11px] text-[#9eb2b8]">
              Image prête pour transcription OCR (<code className="text-[#40dcca]">{previewMime}</code>
              ). Cliquez sur <strong>Extraire via OCR</strong>.
            </div>
          </div>
        )}
      </div>

      {/* Direct Raw Code Paste + Choice of Strategy */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="capture-raw-code" className="text-xs font-medium text-[#e0fdff]">
            2. Coller <code className="text-[#00f2fe]">main.js</code> ou code HTML/JS
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setRawCode(SAMPLE_MAIN_JS_SNIPPET);
                setOcrError(null);
              }}
              className="text-[11px] font-mono text-[#40dcca] hover:underline"
            >
              Exemple main.js (Node/Acode)
            </button>
            <button
              type="button"
              onClick={() => {
                setRawCode(SAMPLE_RAW_CODE_SNIPPET);
                setOcrError(null);
              }}
              className="text-[11px] font-mono text-[#00f2fe] hover:underline"
            >
              Exemple HTML + POI
            </button>
          </div>
        </div>

        <textarea
          id="capture-raw-code"
          rows={7}
          value={rawCode}
          onChange={(e) => setRawCode(e.target.value)}
          placeholder="Collez ici le contenu de main.js (Acode / Spck / Node.js) ou votre extrait HTML + <script> POI..."
          className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg p-3 text-xs font-mono text-[#dce3f0] placeholder-[#849495] focus:outline-none focus:border-[#00f2fe]"
        />

        {/* Choice: Full code generation vs progressive integration */}
        <div className="p-2.5 rounded-lg bg-[#080f18] border border-[#3a494b]/60 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#9eb2b8]">
            Stratégie de sortie :
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIntegrationMode('complete');
                if (rawCode.trim()) handleAnalyzeAndSplit('complete');
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                integrationMode === 'complete'
                  ? 'bg-[#00f2fe] text-[#002022] font-bold'
                  : 'bg-[#19202a] text-[#9eb2b8] hover:text-[#e0fdff]'
              }`}
            >
              Génération complète
            </button>
            <button
              type="button"
              onClick={() => {
                setIntegrationMode('progressive');
                if (rawCode.trim()) handleAnalyzeAndSplit('progressive');
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                integrationMode === 'progressive'
                  ? 'bg-[#40dcca] text-[#002022] font-bold'
                  : 'bg-[#19202a] text-[#9eb2b8] hover:text-[#e0fdff]'
              }`}
            >
              Intégration progressive (patch main.js)
            </button>
          </div>
        </div>

        {ocrError && (
          <div className="p-2.5 rounded-lg bg-[#93000a]/30 border border-[#ffb4ab]/40 text-xs text-[#ffb4ab]">
            {ocrError}
          </div>
        )}

        <button
          type="button"
          onClick={() => handleAnalyzeAndSplit()}
          className="w-full py-2.5 px-4 rounded-lg bg-[#40dcca] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>
            Auditer main.js, Verrouiller (Code Admin serveur) &amp; Générer ({integrationMode === 'complete' ? 'Complet' : 'Progressif'})
          </span>
        </button>
      </div>

      {/* Audit Findings & Modular Outputs */}
      {result && (
        <div className="space-y-3 pt-2 border-t border-[#3a494b]/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.findings.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-[#080f18] border border-[#40dcca]/35 flex items-start gap-2 text-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-[#40dcca] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-[#e0fdff]">{item.label}</div>
                  <div className="text-[11px] text-[#9eb2b8] leading-relaxed">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 4 Separated Modules */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1 bg-[#080f18] p-1 rounded-lg border border-[#3a494b]/60">
                <button
                  type="button"
                  onClick={() => setOutputTab('client')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    outputTab === 'client'
                      ? 'bg-[#00f2fe] text-[#002022] font-bold'
                      : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                  }`}
                >
                  {isProgressive ? '1. Patch main.js' : '1. Client / Invité'}
                </button>
                <button
                  type="button"
                  onClick={() => setOutputTab('protection')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    outputTab === 'protection'
                      ? 'bg-[#40dcca] text-[#002022] font-bold'
                      : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                  }`}
                >
                  2. Verrouillage Admin
                </button>
                <button
                  type="button"
                  onClick={() => setOutputTab('admin')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    outputTab === 'admin'
                      ? 'bg-[#ffba38] text-[#002022] font-bold'
                      : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                  }`}
                >
                  3. Module Admin POI
                </button>
                <button
                  type="button"
                  onClick={() => setOutputTab('gps')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    outputTab === 'gps'
                      ? 'bg-[#e0fdff] text-[#002022] font-bold'
                      : 'text-[#9eb2b8] hover:text-[#e0fdff]'
                  }`}
                >
                  4. JSON GPS (lat/long)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(activeContent);
                    onNotify(`${activeFileName} copié`);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b] text-[11px] font-mono text-[#40dcca] flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copier</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadActiveFile}
                  className="px-2.5 py-1.5 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-[11px] font-bold flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>{activeFileName}</span>
                </button>
              </div>
            </div>

            <div className="bg-[#080f18] border border-[#3a494b]/60 rounded-lg p-3">
              <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-[#3a494b]/40 text-[11px] font-mono text-[#9eb2b8]">
                <FileCode2 className="w-3.5 h-3.5 text-[#00f2fe]" />
                <span>{activeFileName}</span>
              </div>
              <pre className="text-[11px] font-mono text-[#dce3f0] leading-relaxed max-h-64 overflow-y-auto overflow-x-auto select-all">
                {activeContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
