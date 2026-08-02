const mockAppVersion = { current: '1.4.0' };

jest.mock('../appVersion', () => ({
  currentAppVersion: () => mockAppVersion.current,
}));

// The headers are resolved once at module scope, so each case needs a fresh
// evaluation rather than a re-read.
function loadHeaders(): Readonly<Record<string, string>> {
  let loaded!: typeof import('../appIdentityHeaders');
  jest.isolateModules(() => {
    // `requireActual` so the module under test is real; its own imports still
    // resolve through the registry, so the mocked version above applies.
    loaded = jest.requireActual('../appIdentityHeaders') as typeof loaded;
  });
  return loaded.APP_IDENTITY_HEADERS;
}

describe('APP_IDENTITY_HEADERS', () => {
  beforeEach(() => {
    mockAppVersion.current = '1.4.0';
  });

  it('carries the version and platform', () => {
    const headers = loadHeaders();

    expect(headers['X-App-Version']).toBe('1.4.0');
    expect(headers['X-App-Platform']).toBe('ios');
  });

  it('omits the version rather than sending "unknown"', () => {
    mockAppVersion.current = 'unknown';

    const headers = loadHeaders();

    // 'unknown' looks like a real value in a dashboard and quietly becomes the
    // largest cohort; absent is honest.
    expect(headers).not.toHaveProperty('X-App-Version');
    expect(headers['X-App-Platform']).toBe('ios');
  });

  it('never carries a per-install or per-device identifier', () => {
    const headers = loadHeaders();

    // This rides on every request, which makes it the most tempting place to
    // smuggle one in. Failing here is the point.
    expect(Object.keys(headers).sort()).toEqual(['X-App-Platform', 'X-App-Version']);
  });

  it('cannot be mutated by a caller spreading it', () => {
    const headers = loadHeaders();

    expect(Object.isFrozen(headers)).toBe(true);
  });
});
