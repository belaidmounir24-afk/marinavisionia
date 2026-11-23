import {
  MarineFeatureKey,
  MarineToolsConfig,
  PricingPlanConfig,
  SubscriptionTier,
} from '../types/marine';

export const DEFAULT_MARINE_TOOLS_CONFIG: MarineToolsConfig = {
  schema: 'marine_tools_config.json',
  active_plan: 'free',
  plans: [
    {
      id: 'one_time',
      label: 'One Time',
      price_eur: 41.99,
      billing_cycle: 'Achat unique',
    },
    {
      id: 'yearly',
      label: 'Yearly',
      price_eur: 12.99,
      billing_cycle: 'Par an',
    },
    {
      id: 'weekly',
      label: 'Weekly',
      price_eur: 31.99,
      billing_cycle: 'Par semaine',
    },
  ],
  pricing_revised: false,
  features: {
    ais_stream: {
      label: 'Flux AIS Temps Réel (AISStream)',
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
    ollama_ai_scan: {
      label: 'Analyse Bathymétrique IA (/ollama)',
      required_tier: 'premium',
      enabled: true,
    },
    nmea_bridge: {
      label: 'Passerelle NMEA 0183 / AIS Série',
      required_tier: 'free',
      enabled: true,
    },
    excel_auto_log: {
      label: 'Auto-Log Trajets Excel (60s)',
      required_tier: 'premium',
      enabled: true,
    },
  },
  sensors_api: {
    geolocation: 'navigator.geolocation',
    compass: 'DeviceOrientationEvent',
    ais_provider: 'AISStream',
  },
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
  const yearly = plans.find((p) => p.id === 'yearly');
  const weekly = plans.find((p) => p.id === 'weekly');
  if (!yearly || !weekly) return false;
  return weekly.price_eur >= yearly.price_eur;
}

export function getTierLabel(tier: SubscriptionTier): string {
  switch (tier) {
    case 'one_time':
      return 'Premium · One Time';
    case 'yearly':
      return 'Premium · Yearly';
    case 'weekly':
      return 'Premium · Weekly';
    default:
      return 'Gratuit (Free)';
  }
}
