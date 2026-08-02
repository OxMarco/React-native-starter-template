const IDENTITY_KEYS = [
  'APP_NAME',
  'APP_SLUG',
  'APP_SCHEME',
  'IOS_BUNDLE_IDENTIFIER',
  'ANDROID_PACKAGE',
  'EAS_PROJECT_ID',
  'EAS_BUILD_PROJECT_ID',
  'EAS_BUILD',
  'EAS_BUILD_PROFILE',
  'SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_SEND_DEFAULT_PII',
  'POSTHOG_API_KEY',
  'POSTHOG_HOST',
  'APP_STORE_ID',
  'APP_STORE_COUNTRY',
] as const;

const originalEnvironment = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnvironment };
  IDENTITY_KEYS.forEach((key) => delete process.env[key]);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = originalEnvironment;
});

describe('Expo app configuration', () => {
  it('names every missing identity value in an EAS build', () => {
    process.env.EAS_BUILD = 'true';
    process.env.IOS_BUNDLE_IDENTIFIER = 'com.acme.example';
    process.env.ANDROID_PACKAGE = 'com.acme.example';

    expect(loadConfig).toThrow('APP_NAME, APP_SLUG, APP_SCHEME');
  });

  it('accepts a complete non-placeholder production identity', () => {
    setProductionIdentity();

    expect(loadConfig()).toMatchObject({
      name: 'Acme App',
      slug: 'acme-app',
      scheme: 'acmeapp',
      ios: { bundleIdentifier: 'com.acme.app' },
      android: { package: 'com.acme.app' },
    });
  });

  it('uses the EAS-provided build project id', () => {
    setProductionIdentity();
    process.env.EAS_BUILD_PROJECT_ID = 'build-project-id';

    expect(loadConfig()).toMatchObject({
      extra: { eas: { projectId: 'build-project-id' } },
    });
  });

  it('omits unset observability values rather than publishing empty ones', () => {
    setProductionIdentity();

    const { extra } = loadConfig();

    // `src/lib/appConfig.ts` treats an absent key as "feature off". An empty
    // string would read as configured and initialise a client that can never
    // deliver anything.
    expect(extra).not.toHaveProperty('sentryDsn');
    expect(extra).not.toHaveProperty('posthogApiKey');
    expect(extra).not.toHaveProperty('appStoreId');
    expect(extra).toMatchObject({
      sentrySendDefaultPii: false,
      posthogHost: 'https://eu.i.posthog.com',
      appStoreCountry: 'us',
      androidPackage: 'com.acme.app',
    });
  });

  it('publishes configured observability and store values', () => {
    setProductionIdentity();
    process.env.SENTRY_DSN = 'https://public@o1.ingest.sentry.io/2';
    process.env.SENTRY_SEND_DEFAULT_PII = 'true';
    process.env.POSTHOG_API_KEY = 'phc_example';
    process.env.POSTHOG_HOST = 'https://us.i.posthog.com';
    process.env.APP_STORE_ID = '1234567890';
    process.env.APP_STORE_COUNTRY = 'gb';

    expect(loadConfig().extra).toMatchObject({
      sentryDsn: 'https://public@o1.ingest.sentry.io/2',
      sentrySendDefaultPii: true,
      posthogApiKey: 'phc_example',
      posthogHost: 'https://us.i.posthog.com',
      appStoreId: '1234567890',
      appStoreCountry: 'gb',
    });
  });

  it('adds the Sentry build plugin only once an org and project are known', () => {
    setProductionIdentity();
    expect(loadConfig().plugins).not.toContainEqual(
      expect.arrayContaining(['@sentry/react-native/expo'])
    );

    process.env.SENTRY_ORG = 'acme';
    process.env.SENTRY_PROJECT = 'acme-app';

    // Including it unconfigured fails prebuild outright rather than degrading
    // to "no source maps".
    expect(loadConfig().plugins).toContainEqual([
      '@sentry/react-native/expo',
      { organization: 'acme', project: 'acme-app' },
    ]);
  });

  it('warns when a production build would ship unsymbolicated crash reports', () => {
    setProductionIdentity();
    process.env.SENTRY_DSN = 'https://public@o1.ingest.sentry.io/2';

    loadConfig();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('source maps will not upload')
    );
  });

  it('does not warn about Sentry when no DSN is configured', () => {
    // A team that has not adopted Sentry yet must still be able to ship without
    // a warning that has no action attached to it.
    setProductionIdentity();

    loadConfig();

    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('source maps will not upload')
    );
  });
});

function setProductionIdentity() {
  process.env.EAS_BUILD = 'true';
  process.env.EAS_BUILD_PROFILE = 'production';
  process.env.APP_NAME = 'Acme App';
  process.env.APP_SLUG = 'acme-app';
  process.env.APP_SCHEME = 'acmeapp';
  process.env.IOS_BUNDLE_IDENTIFIER = 'com.acme.app';
  process.env.ANDROID_PACKAGE = 'com.acme.app';
}

function loadConfig() {
  let loaded!: typeof import('../../../app.config');
  jest.isolateModules(() => {
    loaded = jest.requireActual('../../../app.config') as typeof loaded;
  });
  return loaded.default({ config: {} } as Parameters<typeof loaded.default>[0]);
}
