export type IntegrationMode = 'complete' | 'progressive';

export interface CodeAuditFinding {
  id: string;
  label: string;
  status: 'cleaned' | 'verified' | 'info';
  detail: string;
}

export interface SecurizerResult {
  mode: IntegrationMode;
  isMainJs: boolean;
  hasAdminButton: boolean;
  hasPoiScript: boolean;
  hasNodeFs: boolean;
  findings: CodeAuditFinding[];
  clientHtml: string;
  protectionScript: string;
  adminPoiScript: string;
  gpsJsonWriterScript: string;
}

export const SAMPLE_RAW_CODE_SNIPPET = `<!-- Extrait HTML / JS (Spck / Navigateur) à sécuriser et séparer -->
<header class="marina-bar">
  <span id="brand-logo">Marina Visionnaire</span>
  <button id="btn-admin" onclick="activerModeAdmin()">Activer Mode Admin</button>
</header>

<section id="poi-list"></section>

<script>
  const pointsInteret = [
    { id: 'POI-01', nom: 'Golfe de Skikda', lat: 36.889, lon: 6.912 },
    { id: 'POI-02', nom: 'Îles Lavezzi', lat: 41.339, lon: 9.257 }
  ];

  function activerModeAdmin() {
    localStorage.setItem('IS_ADMIN', 'true');
    document.getElementById('admin-panel').style.display = 'block';
  }

  function ajouterPointInteret(nom, lat, lon) {
    pointsInteret.push({ id: 'POI-' + (pointsInteret.length + 1), nom, lat, lon });
    renderPois();
  }

  function renderPois() {
    const container = document.getElementById('poi-list');
    if (!container) return;
    container.textContent = pointsInteret.map((p) => p.nom + ' (' + p.lat + ', ' + p.lon + ')').join(' · ');
  }
</script>`;

export const SAMPLE_MAIN_JS_SNIPPET = `// main.js — Ébauche Node.js / Acode / Spck à auditer et consolider
import fs from 'node:fs';

const MEMOIRE_PATH = './visionia_memoire.json';

function verifierAdminLocal() {
  return typeof localStorage !== 'undefined' && localStorage.getItem('IS_ADMIN') === 'true';
}

function ajouterPointGps(nom, lat, long) {
  const data = fs.existsSync(MEMOIRE_PATH)
    ? JSON.parse(fs.readFileSync(MEMOIRE_PATH, 'utf8'))
    : { points_gps: [] };
  data.points_gps.push({ nom, lat, long });
  fs.writeFileSync(MEMOIRE_PATH, JSON.stringify(data, null, 2));
}

export { verifierAdminLocal, ajouterPointGps };`;

function extractScriptBlocks(raw: string): {
  htmlWithoutScripts: string;
  scriptsCombined: string;
  isMainJs: boolean;
} {
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: string[] = [];
  const htmlWithoutScripts = raw.replace(scriptRegex, (_match, body: string) => {
    const trimmed = String(body || '').trim();
    if (trimmed) scripts.push(trimmed);
    return '';
  });

  const looksLikeJsOnly =
    scripts.length === 0 && !/<(?:html|head|body|header|section|button|div|span)\b/i.test(raw);

  if (looksLikeJsOnly) {
    return {
      htmlWithoutScripts:
        '<header class="marina-bar">\n  <span id="brand-logo" data-marina-brand="true">Marina Visionnaire</span>\n</header>\n<section id="poi-list"></section>',
      scriptsCombined: raw.trim(),
      isMainJs: true,
    };
  }

  return {
    htmlWithoutScripts: htmlWithoutScripts.trim(),
    scriptsCombined: scripts.join('\n\n').trim(),
    isMainJs: false,
  };
}

function stripExposedAdminButtons(html: string): { cleanedHtml: string; removedCount: number } {
  let removedCount = 0;
  const adminBtnRegex =
    /<button\b[^>]*>[\s\S]*?(?:mode\s*admin|activer\s*admin|administration|is_admin)[\s\S]*?<\/button>/gi;

  let cleanedHtml = html.replace(adminBtnRegex, () => {
    removedCount += 1;
    return '<!-- Bouton Admin retiré du DOM Invité (déverrouillage discret par 5 clics) -->';
  });

  if (!/data-marina-brand/i.test(cleanedHtml)) {
    if (/<(span|div|a|h1|button)\b[^>]*(?:brand|logo|marina)[^>]*>/i.test(cleanedHtml)) {
      cleanedHtml = cleanedHtml.replace(
        /<(span|div|a|h1|button)\b([^>]*(?:brand|logo|marina)[^>]*)>/i,
        '<$1$2 data-marina-brand="true">'
      );
    } else {
      cleanedHtml =
        '<header class="marina-bar">\n  <span data-marina-brand="true">Marina Visionnaire</span>\n</header>\n' +
        cleanedHtml;
    }
  }

  return { cleanedHtml: cleanedHtml.trim(), removedCount };
}

function sanitizeClientAndPoiScript(rawScript: string): {
  cleanedPoiScript: string;
  removedInlineAuthCount: number;
  sanitizedDomCount: number;
} {
  let removedInlineAuthCount = 0;
  let sanitizedDomCount = 0;

  let script = rawScript;

  // Remove hardcoded numeric or alphanumeric admin codes (e.g. PREFIX-2026-XX or numeric PINs)
  script = script.replace(
    /\b(?:const|let|var)?\s*(?:pin|admin_?pin|admin_?code|access_?code|passcode|code_?secret|secret)\s*[:=]{1,3}\s*['"`][A-Za-z0-9_-]{4,32}['"`]\s*;?/gi,
    () => {
      removedInlineAuthCount += 1;
      return '// Code administrateur déplacé exclusivement côté serveur (process.env.ADMIN_PIN + /api/admin/unlock)';
    }
  );

  // Remove localStorage / sessionStorage IS_ADMIN mutations or checks
  script = script.replace(
    /(?:localStorage|sessionStorage)\.(?:setItem|getItem)\s*\(\s*['"`][^'"`]*admin[^'"`]*['"`][^)]*\)\s*(?:===\s*['"`]true['"`])?\s*;?/gi,
    () => {
      removedInlineAuthCount += 1;
      return 'false /* Session admin gérée uniquement en mémoire après validation serveur */';
    }
  );

  // Remove exposed activerModeAdmin / verifierAdminLocal client-side bypass functions
  script = script.replace(
    /function\s+(?:activerModeAdmin|verifierAdminLocal)\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
    () => {
      removedInlineAuthCount += 1;
      return '// Bypass admin local supprimé : utiliser getAdminToken() / POST /api/admin/unlock';
    }
  );

  // Flag innerHTML / eval replacements for safe DOM rendering
  script = script.replace(/\.innerHTML\s*=/g, () => {
    sanitizedDomCount += 1;
    return '.textContent =';
  });

  script = script.replace(/\beval\s*\(/g, () => {
    sanitizedDomCount += 1;
    return 'JSON.parse(';
  });

  return {
    cleanedPoiScript: script.trim(),
    removedInlineAuthCount,
    sanitizedDomCount,
  };
}

function buildGpsJsonWriterModule(mode: IntegrationMode): string {
  const headerComment =
    mode === 'progressive'
      ? '// patch-03-gps-json.js — Greffe progressive écriture JSON Points GPS (visionia_memoire)'
      : '// visionia-gps-writer.js — Module complet schéma JSON GPS (lat/long WGS84) pour Node.js & Acode/Spck';

  return `${headerComment}
export function validateGpsCoordinates(latInput, longInput) {
  const lat = Number(String(latInput).replace(',', '.'));
  const lon = Number(String(longInput).replace(',', '.'));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude invalide : valeur attendue entre -90 et 90.');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Longitude invalide : valeur attendue entre -180 et 180.');
  }
  return {
    lat: Number(lat.toFixed(5)),
    long: Number(lon.toFixed(5)),
    gps: {
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      datum: 'WGS84',
    },
  };
}

export function buildGpsPointRecord({ nom, lat, long, zone = 'skikda', type = 'anchor', depth = 24 }) {
  const coords = validateGpsCoordinates(lat, long);
  return {
    id: 'GPS-' + Date.now(),
    nom: String(nom || 'Point GPS MarineVision').trim(),
    lat: coords.lat,
    long: coords.long,
    gps: coords.gps,
    zone,
    type,
    depth: Number(depth) || 24,
    created_at: new Date().toISOString(),
  };
}

// Écriture JSON atomique côté Node.js (main.js) vers visionia_memoire.json
export async function appendPointToVisioniaMemoireNode(fsPromises, pathModule, filePath, pointInput, adminToken) {
  if (!adminToken) {
    throw new Error('Écriture refusée : jeton administrateur manquant.');
  }
  const safePath = pathModule.resolve(process.cwd(), pathModule.basename(filePath || 'visionia_memoire.json'));
  let store = { schema: 'marinevision.memoire.gps/v2', points_gps: [] };
  try {
    const raw = await fsPromises.readFile(safePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.points_gps)) {
      store = parsed;
    }
  } catch {
    // Création initiale du fichier visionia_memoire.json
  }
  const nextPoint = buildGpsPointRecord(pointInput);
  store.points_gps.unshift(nextPoint);
  await fsPromises.writeFile(safePath, JSON.stringify(store, null, 2), 'utf8');
  return nextPoint;
}`;
}

export function analyzeAndSplitAdminPoiCode(
  rawSource: string,
  mode: IntegrationMode = 'complete'
): SecurizerResult {
  const source = rawSource.trim();
  const hasAdminButton =
    /<button\b/i.test(source) || /activer\s*mode\s*admin|verifieradmin|is_admin|admin/i.test(source);
  const hasPoiScript =
    /<script\b/i.test(source) || /poi|pointsinteret|points_gps|waypoints|lat|lon/i.test(source);
  const hasNodeFs = /\b(?:node:fs|require\s*\(\s*['"]fs['"]\)|writeFileSync|readFileSync|express)\b/i.test(
    source
  );
  const hasGpsLatLong = /\blat\b/i.test(source) && /\b(?:lon|long)\b/i.test(source);

  const { htmlWithoutScripts, scriptsCombined, isMainJs } = extractScriptBlocks(source);
  const { cleanedHtml, removedCount } = stripExposedAdminButtons(htmlWithoutScripts);
  const { cleanedPoiScript, removedInlineAuthCount, sanitizedDomCount } =
    sanitizeClientAndPoiScript(scriptsCombined);

  const findings: CodeAuditFinding[] = [
    {
      id: 'audit-source',
      label: isMainJs ? 'Audit main.js (Node.js / Acode / Spck)' : 'Audit HTML + Script POI',
      status: hasAdminButton || hasPoiScript || isMainJs ? 'verified' : 'info',
      detail: `${isMainJs ? 'Module JS détecté' : 'Template HTML/JS détecté'} · ${
        hasNodeFs ? 'Accès fichiers Node.js fs détecté (sécurisation path.basename ajoutée)' : 'Exécution navigateur'
      } · ${hasGpsLatLong ? 'Champs lat/long détectés' : 'Schéma lat/long WGS84 injecté'}`,
    },
    {
      id: 'dom-guest-clean',
      label: 'Surface Invité épurée',
      status: 'cleaned',
      detail:
        removedCount > 0
          ? `${removedCount} bouton(s) d'accès Admin supprimé(s) du DOM client et remplacé(s) par l'ancre discrète [data-marina-brand]`
          : 'Ancre discrète [data-marina-brand] prête sans exposer de contrôle Admin aux invités',
    },
    {
      id: 'admin-code-server',
      label: 'Verrouillage par code administrateur',
      status: 'cleaned',
      detail:
        removedInlineAuthCount > 0
          ? `${removedInlineAuthCount} vérification(s) locale(s) ou code(s) en clair retiré(s) ; authentification migrée vers POST /api/admin/unlock`
          : 'Déclencheur 5 clics + vérification code administrateur côté serveur générés sans secret en clair',
    },
    {
      id: 'strategy-choice',
      label: mode === 'complete' ? 'Génération complète générée' : 'Intégration progressive générée',
      status: 'verified',
      detail:
        sanitizedDomCount > 0
          ? `${sanitizedDomCount} écriture(s) DOM/eval assainie(s) · sortie formatée en mode ${
              mode === 'complete' ? 'architecture complète' : 'patch progressif pour main.js'
            }`
          : `Architecture prête en mode ${
              mode === 'complete' ? 'génération complète (4 modules)' : 'intégration progressive (patchs main.js)'
            }`,
    },
  ];

  const clientHtml =
    mode === 'progressive'
      ? `// patch-01-nettoyage-main.js — Étape 1 : Nettoyage progressif de main.js (Acode / Spck / Node.js)
// Remplacez vos appels directs à localStorage/innerHTML par ces adaptateurs sûrs :

${cleanedPoiScript || '// Collez ici le corps de votre main.js existant pour appliquer le patch'}`
      : `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Marina Visionnaire — Mode Invité</title>
</head>
<body>
  <!-- Partie Client / Invité épurée (aucun bouton Admin visible) -->
${cleanedHtml
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}

  <!-- Modules chargés de façon modulaire -->
  <script type="module" src="./admin-gate-security.js"></script>
  <script type="module" src="./admin-poi-module.js"></script>
</body>
</html>`;

  const protectionScript = `${
    mode === 'progressive'
      ? '// patch-02-admin-gate.js — Étape 2 : Greffe progressive du verrouillage par code administrateur'
      : '// admin-gate-security.js — Déverrouillage discret 5 clics + vérification code administrateur serveur'
  }
let memoryAdminToken = null;
let clickCount = 0;
let clickTimer = null;

const CLICK_THRESHOLD = 5;
const CLICK_WINDOW_MS = 2500;

export function getAdminToken() {
  return memoryAdminToken;
}

export function isAdminUnlocked() {
  return Boolean(memoryAdminToken);
}

export function lockAdminSession() {
  memoryAdminToken = null;
  window.dispatchEvent(new CustomEvent('marina:admin-state', { detail: { unlocked: false } }));
}

function openAdminCodeDialog() {
  if (document.getElementById('marina-pin-dialog')) return;

  const overlay = document.createElement('div');
  overlay.id = 'marina-pin-dialog';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(4,9,15,0.82);display:flex;align-items:center;justify-content:center;padding:16px;';

  const card = document.createElement('form');
  card.style.cssText =
    'width:100%;max-width:340px;background:#10161e;border:1px solid #00f2fe;border-radius:12px;padding:18px;color:#e0fdff;font-family:sans-serif;';

  const title = document.createElement('h3');
  title.textContent = 'Accès Passerelle Admin';
  title.style.cssText = 'margin:0 0 8px 0;font-size:15px;';

  const input = document.createElement('input');
  input.type = 'password';
  input.autocomplete = 'one-time-code';
  input.placeholder = 'Code Administrateur (vérifié serveur)';
  input.style.cssText =
    'width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #3a494b;background:#080f18;color:#00f2fe;margin-bottom:10px;';

  const status = document.createElement('p');
  status.style.cssText = 'margin:0 0 10px 0;font-size:12px;color:#ffb4ab;min-height:16px;';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Annuler';
  cancelBtn.style.cssText =
    'padding:8px 12px;border-radius:8px;border:1px solid #3a494b;background:#19202a;color:#dce3f0;cursor:pointer;';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Déverrouiller';
  submitBtn.style.cssText =
    'padding:8px 14px;border-radius:8px;border:none;background:#00f2fe;color:#002022;font-weight:700;cursor:pointer;';

  card.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    try {
      const resp = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: input.value.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.token) {
        status.textContent = data.error || 'Code administrateur refusé';
        return;
      }
      memoryAdminToken = data.token;
      overlay.remove();
      window.dispatchEvent(new CustomEvent('marina:admin-state', { detail: { unlocked: true } }));
    } catch {
      status.textContent = 'Erreur réseau lors de la vérification serveur';
    }
  });

  actions.append(cancelBtn, submitBtn);
  card.append(title, input, status, actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  input.focus();
}

export function initSecretBrandGate() {
  const brandTrigger = document.querySelector('[data-marina-brand]');
  if (!brandTrigger) return;

  brandTrigger.addEventListener('click', () => {
    clickCount += 1;
    if (clickTimer) clearTimeout(clickTimer);
    if (clickCount >= CLICK_THRESHOLD) {
      clickCount = 0;
      openAdminCodeDialog();
      return;
    }
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, CLICK_WINDOW_MS);
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initSecretBrandGate);
}`;

  const adminPoiScript = `${
    mode === 'progressive'
      ? '// patch-02b-admin-poi-guard.js — Garde-fou progressif à importer dans votre main.js'
      : '// admin-poi-module.js — Gestion POI isolée (verrouillée tant que le code admin serveur n’est pas validé)'
  }
import { getAdminToken, isAdminUnlocked } from './admin-gate-security.js';
import { buildGpsPointRecord } from './visionia-gps-writer.js';

export function guardAdminAction(actionName) {
  if (!isAdminUnlocked() || !getAdminToken()) {
    throw new Error('Action "' + actionName + '" réservée à la session Admin vérifiée.');
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('marina:admin-state', (event) => {
    const unlocked = Boolean(event.detail && event.detail.unlocked);
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
      adminPanel.hidden = !unlocked;
    }
  });
}

// --- Logique POI / main.js auditée et protégée ---
${
  cleanedPoiScript ||
  `const pointsInteret = [];
export function ajouterPointInteret(nom, lat, long) {
  guardAdminAction('ajouterPointInteret');
  const point = buildGpsPointRecord({ nom, lat, long });
  pointsInteret.push(point);
  return point;
}`
}`;

  const gpsJsonWriterScript = buildGpsJsonWriterModule(mode);

  return {
    mode,
    isMainJs,
    hasAdminButton,
    hasPoiScript,
    hasNodeFs,
    findings,
    clientHtml,
    protectionScript,
    adminPoiScript,
    gpsJsonWriterScript,
  };
}
