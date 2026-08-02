import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  analyticsConsentSetting,
  decodeAnalyticsConsent,
  DEFAULT_ANALYTICS_CONSENT,
} from '../analyticsConsent';

describe('analytics consent', () => {
  it.each(['granted', 'denied'] as const)('accepts %s', (value) => {
    expect(decodeAnalyticsConsent(value)).toBe(value);
  });

  it('defaults to granted — reporting is on until the user turns it off', () => {
    expect(DEFAULT_ANALYTICS_CONSENT).toBe('granted');
    expect(decodeAnalyticsConsent(null)).toBe('granted');
  });

  it('never reads an unrecognised stored value as a withdrawal', () => {
    // 'undecided' existed in an earlier three-state schema. Under an opt-out
    // model anything unrecognised resolves to the default; only an explicit
    // 'denied' turns reporting off.
    expect(decodeAnalyticsConsent('undecided')).toBe('granted');
    expect(decodeAnalyticsConsent('yes')).toBe('granted');
    expect(decodeAnalyticsConsent('')).toBe('granted');
  });
});

describe('the stored setting', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('reads as granted on a fresh install', async () => {
    // The decoder default and the setting's own default have to agree, or a
    // fresh install renders one state in Settings and reports another.
    expect(analyticsConsentSetting.defaultValue).toBe('granted');
    await expect(analyticsConsentSetting.read()).resolves.toBe('granted');
  });

  it('keeps a withdrawal across a reload', async () => {
    await analyticsConsentSetting.set('denied');

    expect(await AsyncStorage.getItem('starter:analytics-consent:v1')).toBe('denied');
    expect(decodeAnalyticsConsent(await AsyncStorage.getItem('starter:analytics-consent:v1'))).toBe(
      'denied'
    );
  });
});
