import {
  appStoreUrl,
  DEFAULT_APP_STORE_COUNTRY,
  DEFAULT_POSTHOG_HOST,
  getAppConfig,
  playStoreUrl,
} from '../appConfig';

// `Constants.expoConfig` is a non-configurable getter, so it cannot be spied on.
const mockExtra: { current: Record<string, unknown> } = { current: {} };

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra.current };
    },
  },
}));

function withExtra(extra: Record<string, unknown>) {
  mockExtra.current = extra;
}

describe('getAppConfig', () => {
  it('falls back to safe defaults when nothing is configured', () => {
    withExtra({});

    expect(getAppConfig()).toEqual({
      sentryDsn: undefined,
      sentrySendDefaultPii: false,
      posthogApiKey: undefined,
      posthogHost: DEFAULT_POSTHOG_HOST,
      appStoreId: undefined,
      appStoreCountry: DEFAULT_APP_STORE_COUNTRY,
      androidPackage: undefined,
    });
  });

  it('treats blank and non-string values as unset', () => {
    // An empty string would otherwise read as configured and produce a client
    // that initialises but can never deliver anything.
    withExtra({ sentryDsn: '   ', posthogApiKey: 42, appStoreId: '', androidPackage: null });

    const config = getAppConfig();

    expect(config.sentryDsn).toBeUndefined();
    expect(config.posthogApiKey).toBeUndefined();
    expect(config.appStoreId).toBeUndefined();
    expect(config.androidPackage).toBeUndefined();
  });

  it('only enables sendDefaultPii for an explicit boolean true', () => {
    withExtra({ sentrySendDefaultPii: 'true' });
    expect(getAppConfig().sentrySendDefaultPii).toBe(false);

    withExtra({ sentrySendDefaultPii: true });
    expect(getAppConfig().sentrySendDefaultPii).toBe(true);
  });

  it('builds store URLs only for a configured platform', () => {
    withExtra({});
    expect(appStoreUrl()).toBeNull();
    expect(playStoreUrl()).toBeNull();

    withExtra({ appStoreId: '1234567890', androidPackage: 'com.acme.app' });
    expect(appStoreUrl()).toBe('https://apps.apple.com/app/id1234567890');
    expect(playStoreUrl()).toBe('https://play.google.com/store/apps/details?id=com.acme.app');
  });
});
