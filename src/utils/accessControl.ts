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
