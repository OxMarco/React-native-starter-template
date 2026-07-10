import { decodeAnalyticsConsent, DEFAULT_ANALYTICS_CONSENT } from '../analyticsConsent';

describe('analytics consent', () => {
  it.each(['granted', 'denied', 'undecided'] as const)('accepts %s', (value) => {
    expect(decodeAnalyticsConsent(value)).toBe(value);
  });

  it('falls back to undecided for invalid storage', () => {
    expect(decodeAnalyticsConsent(null)).toBe(DEFAULT_ANALYTICS_CONSENT);
    expect(decodeAnalyticsConsent('yes')).toBe(DEFAULT_ANALYTICS_CONSENT);
  });
});
