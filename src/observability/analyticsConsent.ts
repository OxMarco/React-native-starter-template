import { createPersistedSetting, type PersistedSettingCodec } from '@/lib/persistedSetting';

export type AnalyticsConsent = 'undecided' | 'granted' | 'denied';

export const DEFAULT_ANALYTICS_CONSENT: AnalyticsConsent = 'undecided';
export const ANALYTICS_CONSENT_OPTIONS: {
  value: Exclude<AnalyticsConsent, 'undecided'>;
  label: string;
}[] = [
  { value: 'granted', label: 'Share anonymous usage data' },
  { value: 'denied', label: 'Do not share usage data' },
];

export function decodeAnalyticsConsent(raw: string | null): AnalyticsConsent {
  return raw === 'granted' || raw === 'denied' || raw === 'undecided'
    ? raw
    : DEFAULT_ANALYTICS_CONSENT;
}

const codec: PersistedSettingCodec<AnalyticsConsent> = {
  decode: decodeAnalyticsConsent,
  encode: (value) => value,
};

export const analyticsConsentSetting = createPersistedSetting(
  'starter:analytics-consent:v1',
  DEFAULT_ANALYTICS_CONSENT,
  codec
);
