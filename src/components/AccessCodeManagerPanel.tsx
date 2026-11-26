import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import { SubscriptionTier } from '../types/marine';
import {
  buildAndroidModularSnippet,
  buildClientOnboardingMessage,
  genererCodeAcces,
  genererMotDePasse,
  getTierLabel,
  TemporaryAccessCodeRecord,
} from '../utils/accessControl';

interface AccessCodeManagerPanelProps {
  adminToken: string | null;
  onNotify: (msg: string) => void;
  onLog: (tag: string, source: string, detail: string) => void;
}

export const AccessCodeManagerPanel: React.FC<AccessCodeManagerPanelProps> = ({
  adminToken,
  onNotify,
  onLog,
}) => {
  const [tier, setTier] = useState<Exclude<SubscriptionTier, 'free'>>('monthly');
  const [validDays, setValidDays] = useState<number>(30);
  const [codes, setCodes] = useState<TemporaryAccessCodeRecord[]>([]);
  const [latestGenerated, setLatestGenerated] = useState<TemporaryAccessCodeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pwdLength, setPwdLength] = useState<number>(14);
  const [pwdSymbols, setPwdSymbols] = useState<boolean>(true);
  const [generatedPassword, setGeneratedPassword] = useState<string>(() =>
    genererMotDePasse(14, { avecSymboles: true })
  );
  const [showMobileSnippet, setShowMobileSnippet] = useState<boolean>(false);

  const loadCodes = useCallback(async () => {
    if (!adminToken) return;
    try {
      const resp = await fetch('/api/access-codes', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as { codes?: TemporaryAccessCodeRecord[] };
        if (Array.isArray(data.codes)) {
          setCodes(data.codes);
        }
      }
    } catch {
      // ignore transient offline error
    }
  }, [adminToken]);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  const handleGenerate = async () => {
    if (!adminToken) {
      setErrorMsg('Session Admin requise.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/access-codes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ tier, validDays }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        record?: TemporaryAccessCodeRecord;
        error?: string;
      };
      if (!resp.ok || !data.record) {
        setErrorMsg(data.error || 'Impossible de générer le code.');
        return;
      }
      setLatestGenerated(data.record);
      setCodes((prev) => [data.record!, ...prev]);
      onLog(
        'CODE ACCES',
        'genererCodeAcces()',
        `Code temporaire ${data.record.code} généré (${getTierLabel(data.record.tier)}, ${validDays}j) → access_codes.json`
      );
      onNotify(`Code d'accès ${data.record.code} généré`);
    } catch {
      const previewCode = genererCodeAcces();
      setErrorMsg(`Serveur hors ligne (aperçu format : ${previewCode}).`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!adminToken) return;
    try {
      const resp = await fetch(`/api/access-codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (resp.ok) {
        setCodes((prev) => prev.filter((item) => item.code !== code));
        if (latestGenerated?.code === code) {
          setLatestGenerated(null);
        }
        onLog('CODE ACCES', 'access_codes.json', `Code ${code} révoqué`);
        onNotify(`Code ${code} révoqué`);
      }
    } catch {
      onNotify('Erreur lors de la révocation');
    }
  };

  const onboardingMessage = latestGenerated
    ? buildClientOnboardingMessage(
        latestGenerated.code,
        latestGenerated.tier,
        latestGenerated.expiresAt
      )
    : '';

  return (
    <section
      id="access-codes-panel"
      className="rounded-xl bg-[#151c25] border border-[#00f2fe]/40 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#00f2fe]" />
          <h3 className="text-base font-semibold text-[#e0fdff]">
            Codes d&apos;Accès Temporaires (<code className="text-[#40dcca]">MV-XXXX-XX</code>)
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void loadCodes()}
          className="text-xs font-mono text-[#40dcca] hover:underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Actualiser JSON</span>
        </button>
      </div>

      <p className="text-xs text-[#9eb2b8] leading-relaxed">
        Générez un code unique via <code className="text-[#e0fdff]">genererCodeAcces()</code>,
        stocké dans le backend JSON (<code className="text-[#40dcca]">access_codes.json</code>),
        puis partagez le message client pour basculer du <strong>Mode Invité</strong> au{' '}
        <strong>Mode Premium (AISStream)</strong>.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="access-code-tier" className="block text-[11px] text-[#9eb2b8] mb-1">
            Formule Premium débloquée
          </label>
          <select
            id="access-code-tier"
            value={tier}
            onChange={(e) => {
              const nextTier = e.target.value as Exclude<SubscriptionTier, 'free'>;
              setTier(nextTier);
              setValidDays(nextTier === 'annual' ? 365 : nextTier === 'quarterly' ? 90 : 30);
            }}
            className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs text-[#e0fdff] focus:outline-none focus:border-[#00f2fe]"
          >
            <option value="monthly">1 mois · 20 € (AISStream + IA)</option>
            <option value="quarterly">3 mois · 50 € (AISStream + IA)</option>
            <option value="annual">1 an · 100 € (Complet)</option>
          </select>
        </div>

        <div>
          <label htmlFor="access-code-days" className="block text-[11px] text-[#9eb2b8] mb-1">
            Durée de validité du code
          </label>
          <select
            id="access-code-days"
            value={validDays}
            onChange={(e) => setValidDays(Number(e.target.value))}
            className="w-full bg-[#080f18] border border-[#3a494b] rounded-lg px-2.5 py-2 text-xs font-mono text-[#00f2fe] focus:outline-none focus:border-[#00f2fe]"
          >
            <option value={1}>24 heures (essai / sortie)</option>
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={365}>365 jours</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-[#93000a]/30 border border-[#ffb4ab]/40 text-xs text-[#ffb4ab]">
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleGenerate()}
        className="w-full py-2.5 px-4 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] disabled:opacity-50 text-[#002022] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
      >
        <KeyRound className="w-4 h-4" />
        <span>{busy ? 'Génération...' : 'Générer un code unique (genererCodeAcces)'}</span>
      </button>

      {latestGenerated && (
        <div className="p-3.5 rounded-lg bg-[#080f18] border border-[#40dcca]/50 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#40dcca]" />
              <span className="text-sm font-mono font-bold text-[#00f2fe] tracking-wider">
                {latestGenerated.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(latestGenerated.code);
                onNotify(`Code ${latestGenerated.code} copié`);
              }}
              className="px-2.5 py-1 rounded bg-[#19202a] border border-[#3a494b] text-[11px] font-mono text-[#40dcca] flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              <span>Copier code</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#9eb2b8]">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-[#00f2fe]" />
                <span>Modèle de communication client (WhatsApp / SMS)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(onboardingMessage);
                  onNotify('Message d’onboarding client copié');
                }}
                className="text-[#00f2fe] hover:underline font-mono"
              >
                Copier message
              </button>
            </div>
            <pre className="p-2.5 rounded bg-[#151c25] border border-[#3a494b]/50 text-[11px] text-[#dce3f0] whitespace-pre-wrap font-sans leading-relaxed select-all">
              {onboardingMessage}
            </pre>
          </div>
        </div>
      )}

      {codes.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          <div className="text-[11px] font-mono text-[#9eb2b8]">
            Registre backend JSON ({codes.length} code(s))
          </div>
          {codes.map((item) => (
            <div
              key={item.code}
              className="p-2.5 rounded-lg bg-[#080f18] border border-[#3a494b]/50 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-[#00f2fe]">{item.code}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      item.status === 'active'
                        ? 'bg-[#40dcca]/15 text-[#40dcca]'
                        : item.status === 'used'
                          ? 'bg-[#ffba38]/15 text-[#ffba38]'
                          : 'bg-[#93000a]/30 text-[#ffb4ab]'
                    }`}
                  >
                    {item.status === 'active'
                      ? 'Actif'
                      : item.status === 'used'
                        ? 'Utilisé'
                        : 'Expiré'}
                  </span>
                </div>
                <div className="text-[11px] text-[#9eb2b8]">
                  {getTierLabel(item.tier)} · exp.{' '}
                  {new Date(item.expiresAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(item.code);
                    onNotify(`Code ${item.code} copié`);
                  }}
                  aria-label={`Copier ${item.code}`}
                  className="p-1.5 rounded bg-[#19202a] text-[#40dcca] hover:bg-[#232a34]"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.code)}
                  aria-label={`Supprimer ${item.code}`}
                  className="p-1.5 rounded bg-[#19202a] text-[#ffb4ab] hover:bg-[#232a34]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Secure Password Generator (genererMotDePasse) + Android Acode / Spck Snippet */}
      <div
        id="password-generator-panel"
        className="pt-4 border-t border-[#3a494b]/50 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#40dcca]" />
            <h4 className="text-xs font-semibold text-[#e0fdff]">
              Générateur de mot de passe sécurisé (<code className="text-[#00f2fe]">genererMotDePasse</code>)
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowMobileSnippet((v) => !v)}
            className="text-[11px] font-mono text-[#00f2fe] hover:underline"
          >
            {showMobileSnippet ? 'Masquer JS Android' : 'Snippet Acode / Spck'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#080f18] border border-[#3a494b]/50">
            <label htmlFor="pwd-length-select" className="text-[#9eb2b8]">
              Longueur
            </label>
            <select
              id="pwd-length-select"
              value={pwdLength}
              onChange={(e) => {
                const nextLen = Number(e.target.value);
                setPwdLength(nextLen);
                setGeneratedPassword(genererMotDePasse(nextLen, { avecSymboles: pwdSymbols }));
              }}
              className="bg-[#151c25] border border-[#3a494b] rounded px-2 py-1 text-xs font-mono text-[#00f2fe]"
            >
              <option value={12}>12 car.</option>
              <option value={14}>14 car.</option>
              <option value={16}>16 car.</option>
              <option value={20}>20 car.</option>
              <option value={24}>24 car.</option>
            </select>
          </div>

          <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#080f18] border border-[#3a494b]/50 cursor-pointer">
            <span className="text-[#9eb2b8]">Symboles (!@#$...)</span>
            <input
              type="checkbox"
              checked={pwdSymbols}
              onChange={(e) => {
                const nextSym = e.target.checked;
                setPwdSymbols(nextSym);
                setGeneratedPassword(genererMotDePasse(pwdLength, { avecSymboles: nextSym }));
              }}
              className="accent-[#40dcca] w-4 h-4"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[180px] bg-[#080f18] border border-[#40dcca]/40 rounded-lg px-3 py-2 font-mono text-xs text-[#40dcca] break-all select-all">
            {generatedPassword}
          </div>
          <button
            type="button"
            onClick={() => {
              const nextPwd = genererMotDePasse(pwdLength, { avecSymboles: pwdSymbols });
              setGeneratedPassword(nextPwd);
              onLog(
                'SECURITE',
                'genererMotDePasse()',
                `Mot de passe sécurisé généré (${pwdLength} car., symboles=${String(pwdSymbols)})`
              );
              onNotify('Nouveau mot de passe généré');
            }}
            className="px-3 py-2 rounded-lg bg-[#19202a] hover:bg-[#232a34] border border-[#00f2fe]/40 text-xs font-semibold text-[#00f2fe] flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Générer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(generatedPassword);
              onNotify('Mot de passe copié dans le presse-papiers');
            }}
            className="px-3 py-2 rounded-lg bg-[#40dcca] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center gap-1 whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copier</span>
          </button>
        </div>

        {showMobileSnippet && (
          <div className="p-2.5 rounded-lg bg-[#080f18] border border-[#3a494b]/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#9eb2b8]">
              <span>Script modulaire Android (Acode / Spck Editor)</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(buildAndroidModularSnippet());
                  onNotify('Script JS Android copié');
                }}
                className="text-[#40dcca] hover:underline"
              >
                Copier JS
              </button>
            </div>
            <pre className="text-[10px] font-mono text-[#dce3f0] overflow-x-auto max-h-44 select-all">
              {buildAndroidModularSnippet()}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
};
