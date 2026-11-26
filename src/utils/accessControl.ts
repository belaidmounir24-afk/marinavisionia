import {
  ManualLicenseRecord,
  MarineFeatureKey,
  MarineToolsConfig,
  PricingPlanConfig,
  SubscriptionTier,
} from '../types/marine';

export const PROJECT_CONTACT = {
  organization: 'MarineVision AI',
  phone: '+213 6 97 29 60 59',
  email: 'belaid.mounir.40@gmail.com',
  region: 'Méditerranée',
} as const;

export const DEFAULT_MARINE_TOOLS_CONFIG: MarineToolsConfig = {
  schema: 'marine_tools_config.json',
  active_plan: 'free',
  plans: [
    {
      id: 'monthly',
      label: '1 mois',
      price_eur: 20,
      billing_cycle: 'Mensuel · 1 mois',
    },
    {
      id: 'quarterly',
      label: '3 mois',
      price_eur: 50,
      billing_cycle: 'Trimestriel · 3 mois',
    },
    {
      id: 'annual',
      label: '1 an',
      price_eur: 100,
      billing_cycle: 'Annuel · 1 an',
    },
  ],
  pricing_revised: true,
  features: {
    ais_stream: {
      label: 'Flux AIS Temps Réel (AISStream)',
      required_tier: 'premium',
      enabled: true,
    },
    collision_ai_alerts: {
      label: 'Alertes Collision IA & Geofencing (/ollama)',
      required_tier: 'premium',
      enabled: true,
    },
    unlimited_history: {
      label: 'Historique Trajets Illimité (visionia_memoire)',
      required_tier: 'premium',
      enabled: true,
    },
    ollama_ai_scan: {
      label: 'Analyse Bathymétrique IA (/ollama)',
      required_tier: 'premium',
      enabled: true,
    },
    excel_auto_log: {
      label: 'Auto-Log Trajets Excel (60s)',
      required_tier: 'premium',
      enabled: true,
    },
    compass_gps: {
      label: 'Compas Magnétique + GPS Natif',
      required_tier: 'free',
      enabled: true,
    },
    bathymetry_3d: {
      label: 'Calques Bathymétriques & Satellite',
      required_tier: 'free',
      enabled: true,
    },
    nmea_bridge: {
      label: 'Passerelle NMEA 0183 ($GNRMC)',
      required_tier: 'free',
      enabled: true,
    },
  },
  sensors_api: {
    geolocation: 'navigator.geolocation',
    compass: 'DeviceOrientationEvent',
    ais_provider: 'AISStream',
  },
};

export const TURNKEY_LICENSE_PRESETS: Array<{
  code: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  label: string;
}> = [
  { code: 'MV-1M-2026', tier: 'monthly', label: '1 mois (20 €)' },
  { code: 'MV-3M-2026', tier: 'quarterly', label: '3 mois (50 €)' },
  { code: 'MV-1Y-2026', tier: 'annual', label: '1 an (100 €)' },
];

export function normalizeSubscriptionTier(rawTier?: string): SubscriptionTier {
  const val = (rawTier || '').toLowerCase();
  if (val === 'free') return 'free';
  if (val === 'monthly' || val === '1m' || val === 'weekly') return 'monthly';
  if (val === 'quarterly' || val === '3m') return 'quarterly';
  if (val === 'annual' || val === '1y' || val === 'yearly' || val === 'one_time') return 'annual';
  return 'free';
}

export function validateLicenseCode(
  rawCode: string
): { valid: boolean; tier: Exclude<SubscriptionTier, 'free'>; normalized: string } {
  const normalized = String(rawCode || '')
    .trim()
    .toUpperCase();
  if (!normalized) {
    return { valid: false, tier: 'monthly', normalized: '' };
  }
  const preset = TURNKEY_LICENSE_PRESETS.find((p) => p.code === normalized);
  if (preset) {
    return { valid: true, tier: preset.tier, normalized };
  }
  if (/^MV-[A-Z0-9]{2,}-[A-Z0-9]{2,}$/.test(normalized)) {
    const tier: Exclude<SubscriptionTier, 'free'> =
      normalized.includes('1M') || normalized.includes('WEEK')
        ? 'monthly'
        : normalized.includes('3M')
          ? 'quarterly'
          : 'annual';
    return { valid: true, tier, normalized };
  }
  return { valid: false, tier: 'monthly', normalized };
}

export const EMPTY_MANUAL_LICENSE: ManualLicenseRecord = {
  code: '',
  tier: 'annual',
  provider: 'Manuel',
  status: 'none',
  activatedAt: '',
  storedIn: 'visionia_memoire',
};

export function hasAccess(
  feature: MarineFeatureKey,
  toolsConfig: MarineToolsConfig
): boolean {
  const rule = toolsConfig.features[feature];
  if (!rule || !rule.enabled) return false;
  if (rule.required_tier === 'free') return true;
  return toolsConfig.active_plan !== 'free';
}

export function isWeeklyPricingAnomalous(plans: PricingPlanConfig[]): boolean {
  const m1 = plans.find((p) => p.id === 'monthly');
  const y1 = plans.find((p) => p.id === 'annual');
  if (!m1 || !y1) return false;
  return m1.price_eur >= y1.price_eur;
}

export function getTierLabel(tier: SubscriptionTier): string {
  switch (tier) {
    case 'monthly':
    case 'weekly':
      return 'Premium · 1 mois (20 €)';
    case 'quarterly':
      return 'Premium · 3 mois (50 €)';
    case 'annual':
    case 'yearly':
    case 'one_time':
      return 'Premium · 1 an (100 €)';
    default:
      return 'Gratuit (Free)';
  }
}

export interface TemporaryAccessCodeRecord {
  code: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  status: 'active' | 'used' | 'expired';
}

const ACCESS_CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function genererCodeAcces(): string {
  const bytes = new Uint8Array(6);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const numVal = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const digits = String(numVal % 10000).padStart(4, '0');
  const c1 = ACCESS_CODE_ALPHA[bytes[4] % ACCESS_CODE_ALPHA.length];
  const c2 = ACCESS_CODE_ALPHA[bytes[5] % ACCESS_CODE_ALPHA.length];
  return `MV-${digits}-${c1}${c2}`;
}

export function buildClientOnboardingMessage(
  code: string,
  tier: Exclude<SubscriptionTier, 'free'>,
  expiresAtIso: string
): string {
  const expDate = new Date(expiresAtIso).toLocaleDateString('fr-FR');
  return [
    `Bonjour, voici votre code d'accès temporaire Marina Visionnaire (${getTierLabel(tier)}) :`,
    `Code : ${code}`,
    `Validité : jusqu'au ${expDate}`,
    `Pour passer du Mode Invité au Mode Premium (AISStream & Alertes IA débloqués), ouvrez l'app puis saisissez ce code dans la section « Abonnement & AISStream » du tableau Bento.`,
    `Assistance : ${PROJECT_CONTACT.phone} · ${PROJECT_CONTACT.email}`,
  ].join('\n');
}

export interface PasswordGeneratorOptions {
  avecSymboles?: boolean;
  avecMajuscules?: boolean;
  avecChiffres?: boolean;
}

const PWD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PWD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PWD_DIGITS = '23456789';
const PWD_SYMBOLS = '!@#$%&*-_+=';

function randomIndex(max: number): number {
  if (max <= 1) return 0;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let val = 0;
    do {
      globalThis.crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % max;
  }
  return Math.floor(Math.random() * max);
}

export function genererMotDePasse(
  longueur = 14,
  options: PasswordGeneratorOptions = {}
): string {
  const len = Math.max(8, Math.min(64, Math.round(longueur)));
  const useUpper = options.avecMajuscules !== false;
  const useDigits = options.avecChiffres !== false;
  const useSymbols = options.avecSymboles !== false;

  const pools = [PWD_LOWER];
  if (useUpper) pools.push(PWD_UPPER);
  if (useDigits) pools.push(PWD_DIGITS);
  if (useSymbols) pools.push(PWD_SYMBOLS);

  const combined = pools.join('');
  const chars: string[] = [];

  for (const pool of pools) {
    if (chars.length < len) {
      chars.push(pool[randomIndex(pool.length)]);
    }
  }
  while (chars.length < len) {
    chars.push(combined[randomIndex(combined.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}

export function buildAndroidModularSnippet(): string {
  return [
    '// Module JavaScript MarineVision AI (compatible Android · Acode / Spck Editor)',
    'function genererMotDePasse(longueur = 14, avecSymboles = true) {',
    '  const pools = [',
    "    'abcdefghijkmnopqrstuvwxyz',",
    "    'ABCDEFGHJKLMNPQRSTUVWXYZ',",
    "    '23456789',",
    "    ...(avecSymboles ? ['!@#$%&*-_+='] : []),",
    '  ];',
    "  const tout = pools.join('');",
    '  const rnd = (n) => {',
    '    const b = new Uint32Array(1);',
    '    crypto.getRandomValues(b);',
    '    return b[0] % n;',
    '  };',
    '  const chars = pools.map((p) => p[rnd(p.length)]);',
    '  while (chars.length < longueur) chars.push(tout[rnd(tout.length)]);',
    '  for (let i = chars.length - 1; i > 0; i--) {',
    '    const j = rnd(i + 1);',
    '    [chars[i], chars[j]] = [chars[j], chars[i]];',
    '  }',
    "  return chars.join('');",
    '}',
    '',
    '// Lecture modulaire des points GPS depuis data_points.json',
    'async function chargerPointsGPS() {',
    "  const res = await fetch('./data_points.json');",
    '  const data = await res.json();',
    '  return data.points || [];',
    '}',
  ].join('\n');
}


