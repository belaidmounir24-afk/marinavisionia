export interface CodeAuditFinding {
  id: string;
  label: string;
  status: 'cleaned' | 'verified' | 'info';
  detail: string;
}

export interface SecurizerResult {
  hasAdminButton: boolean;
  hasPoiScript: boolean;
  findings: CodeAuditFinding[];
  clientHtml: string;
  protectionScript: string;
  adminPoiScript: string;
}

export const SAMPLE_RAW_CODE_SNIPPET = `<!-- Extrait HTML / JS à sécuriser et séparer -->
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

function extractScriptBlocks(raw: string): { htmlWithoutScripts: string; scriptsCombined: string } {
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: string[] = [];
  const htmlWithoutScripts = raw.replace(scriptRegex, (_match, body: string) => {
    const trimmed = String(body || '').trim();
    if (trimmed) scripts.push(trimmed);
    return '';
  });

  if (scripts.length === 0 && !/<[a-z][\s\S]*>/i.test(raw)) {
    return {
      htmlWithoutScripts: '<header class="marina-bar">\n  <span id="brand-logo">Marina Visionnaire</span>\n</header>\n<section id="poi-list"></section>',
      scriptsCombined: raw.trim(),
    };
  }

  return {
    htmlWithoutScripts: htmlWithoutScripts.trim(),
    scriptsCombined: scripts.join('\n\n').trim(),
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

  // Add discreet 5-click hook attribute on brand element if not already present
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

  // Remove hardcoded numeric PIN comparisons or assignments
  script = script.replace(
    /\b(?:const|let|var)?\s*(?:pin|admin_?pin|passcode|code_?secret)\s*[:=]{1,3}\s*['"`]\d{4,12}['"`]\s*;?/gi,
    () => {
      removedInlineAuthCount += 1;
      return '// Vérification PIN déplacée exclusivement côté serveur (/api/admin/unlock)';
    }
  );

  // Remove localStorage / sessionStorage IS_ADMIN mutations
  script = script.replace(
    /(?:localStorage|sessionStorage)\.(?:setItem|getItem)\s*\(\s*['"`][^'"`]*admin[^'"`]*['"`][^)]*\)\s*;?/gi,
    () => {
      removedInlineAuthCount += 1;
      return 'false /* Session admin gérée uniquement en mémoire après validation serveur */';
    }
  );

  // Remove exposed activerModeAdmin client-side bypass functions
  script = script.replace(
    /function\s+activerModeAdmin\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
    () => {
      removedInlineAuthCount += 1;
      return '// activerModeAdmin() remplacé par le module admin-gate-security.js (5 clics + PIN serveur)';
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

export function analyzeAndSplitAdminPoiCode(rawSource: string): SecurizerResult {
  const source = rawSource.trim();
  const hasAdminButton =
    /<button\b/i.test(source) || /activer\s*mode\s*admin|is_admin|admin/i.test(source);
  const hasPoiScript =
    /<script\b/i.test(source) || /poi|pointsinteret|waypoints|lat|lon/i.test(source);

  const { htmlWithoutScripts, scriptsCombined } = extractScriptBlocks(source);
  const { cleanedHtml, removedCount } = stripExposedAdminButtons(htmlWithoutScripts);
  const { cleanedPoiScript, removedInlineAuthCount, sanitizedDomCount } =
    sanitizeClientAndPoiScript(scriptsCombined);

  const findings: CodeAuditFinding[] = [
    {
      id: 'detect-elements',
      label: 'Éléments analysés',
      status: hasAdminButton && hasPoiScript ? 'verified' : 'info',
      detail: `${hasAdminButton ? 'Bouton Mode Admin détecté' : 'Aucun bouton Admin détecté'} · ${
        hasPoiScript ? 'Script gestion POI détecté' : 'Script POI basique généré'
      }`,
    },
    {
      id: 'dom-guest-clean',
      label: 'Surface Invité épurée',
      status: 'cleaned',
      detail:
        removedCount > 0
          ? `${removedCount} bouton(s) d'accès Admin supprimé(s) du DOM client et remplacé(s) par l'ancre discrète [data-marina-brand]`
          : 'Ancre discrète [data-marina-brand] injectée sans exposer de bouton Admin aux invités',
    },
    {
      id: 'pin-server-gate',
      label: 'Protection 5 clics + PIN serveur',
      status: 'cleaned',
      detail:
        removedInlineAuthCount > 0
          ? `${removedInlineAuthCount} accès local/PIN client supprimé(s) ; vérification migrée vers POST /api/admin/unlock avec jeton en mémoire`
          : 'Détecteur 5 clics (< 2,5 s) + modale PIN vérifiée côté serveur générés sans secret en clair',
    },
    {
      id: 'dom-safety',
      label: 'Séparation Client / Admin POI',
      status: 'verified',
      detail:
        sanitizedDomCount > 0
          ? `${sanitizedDomCount} écriture(s) DOM ou évaluation(s) convertie(s) en rendu sûr + module Admin isolé`
          : 'Modules Client (lecture POI), Protection (5 clics + PIN) et Admin POI séparés proprement',
    },
  ];

  const clientHtml = `<!doctype html>
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

  const protectionScript = `// admin-gate-security.js — Déverrouillage discret 5 clics + vérification PIN côté serveur
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

function openPinDialog() {
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
  input.inputMode = 'numeric';
  input.autocomplete = 'one-time-code';
  input.placeholder = 'Code PIN Administrateur';
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
        status.textContent = data.error || 'Code PIN refusé';
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
      openPinDialog();
      return;
    }
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, CLICK_WINDOW_MS);
  });
}

document.addEventListener('DOMContentLoaded', initSecretBrandGate);`;

  const adminPoiScript = `// admin-poi-module.js — Gestion POI isolée (verrouillée tant que le PIN serveur n'est pas validé)
import { getAdminToken, isAdminUnlocked } from './admin-gate-security.js';

export function guardAdminAction(actionName) {
  if (!isAdminUnlocked() || !getAdminToken()) {
    throw new Error('Action "' + actionName + '" réservée à la session Admin vérifiée.');
  }
}

window.addEventListener('marina:admin-state', (event) => {
  const unlocked = Boolean(event.detail && event.detail.unlocked);
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    adminPanel.hidden = !unlocked;
  }
});

// --- Code POI nettoyé et isolé côté Admin ---
${
  cleanedPoiScript ||
  `const pointsInteret = [];
export function ajouterPointInteret(nom, lat, lon) {
  guardAdminAction('ajouterPointInteret');
  pointsInteret.push({ nom, lat: Number(lat), lon: Number(lon) });
}`
}`;

  return {
    hasAdminButton,
    hasPoiScript,
    findings,
    clientHtml,
    protectionScript,
    adminPoiScript,
  };
}
