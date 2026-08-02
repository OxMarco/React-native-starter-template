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
] as const;

const originalEnvironment = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnvironment };
  IDENTITY_KEYS.forEach((key) => delete process.env[key]);
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
