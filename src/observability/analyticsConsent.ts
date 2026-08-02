import { createPersistedSetting, type PersistedSettingCodec } from '@/lib/persistedSetting';

// The single source of truth for whether this install shares anonymous product
// analytics and crash reports. Both SDK adapters read it: the PostHog adapter
// calls optIn()/optOut(), and the Sentry adapter drops every event in
// `beforeSend` while it is denied.
//
// The model is opt-out: reporting is on by default and stays on until the user
// specifically turns it off in Settings. That is a legitimate-interest posture,
// and it holds only while the data stays anonymous — which is why the adapters
// disable session replay and GeoIP, never call `identify`, and strip
// `event.user` before transmitting. Adding any of that back turns this into a
// decision that needs prior consent instead.
//
// Analytics capture starts on this default immediately rather than waiting for
// the stored value — see the note on `analyticsConsent` in `observability.ts`
// for what that costs during the pre-hydration window. Sentry is stricter: its
// `beforeSend` awaits this read before transmitting, because delaying a crash
// report loses nothing.
//
// A product that identifies users or ships where prior consent is required
// should change DEFAULT_ANALYTICS_CONSENT to 'denied'; nothing else needs to
// change, because every path already reads this value rather than assuming one.
export type AnalyticsConsent = 'granted' | 'denied';

export const DEFAULT_ANALYTICS_CONSENT: AnalyticsConsent = 'granted';

export const ANALYTICS_CONSENT_OPTIONS: { value: AnalyticsConsent; label: string }[] = [
  { value: 'granted', label: 'Share anonymous usage data' },
  { value: 'denied', label: 'Do not share usage data' },
];

// Only an explicitly stored value counts; everything else — an unwritten key,
// a value from an older schema, unreadable storage — is the default. Under an
// opt-out model that resolves to 'granted', so a withdrawal is only durable
// once it has actually been written. `set` publishes 'denied' optimistically to
// keep the current session honest, and Settings surfaces the write failure,
// because a preference that silently reverts on the next launch is close to
// impossible to diagnose from a bug report.
export function decodeAnalyticsConsent(raw: string | null): AnalyticsConsent {
  return raw === 'granted' || raw === 'denied' ? raw : DEFAULT_ANALYTICS_CONSENT;
}

const codec: PersistedSettingCodec<AnalyticsConsent> = {
  decode: decodeAnalyticsConsent,
  encode: (value) => value,
};

export const analyticsConsentSetting = createPersistedSetting(
  'starter:analytics-consent:v1',
  DEFAULT_ANALYTICS_CONSENT,
  codec,
  // Withdrawal reaches every live subscriber immediately, even when the
  // durable write fails, so reporting turns off for the current session.
  { optimisticWhen: (value) => value === 'denied' }
);
