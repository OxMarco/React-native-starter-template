import { Platform } from 'react-native';

import {
  fetchLatestStoreVersion,
  parseAppStoreVersion,
  parsePlayStoreVersion,
} from '../storeVersion';

const mockConfig: { current: Record<string, unknown> } = { current: {} };

jest.mock('../appConfig', () => ({
  getAppConfig: () => mockConfig.current,
}));

jest.mock('@/observability/observability', () => ({
  errorReporter: { captureMessage: jest.fn() },
}));

describe('parseAppStoreVersion', () => {
  it('reads the published version from an iTunes lookup payload', () => {
    expect(parseAppStoreVersion({ resultCount: 1, results: [{ version: '2.4.1' }] })).toBe('2.4.1');
  });

  it.each([
    ['an empty result set', { resultCount: 0, results: [] }],
    ['a missing results array', { resultCount: 0 }],
    ['a null payload', null],
    ['a non-string version', { results: [{ version: 241 }] }],
    ['a single-segment version', { results: [{ version: '241' }] }],
    ['a prerelease version', { results: [{ version: '2.4.1-rc1' }] }],
  ])('returns null for %s', (_label, payload) => {
    expect(parseAppStoreVersion(payload)).toBeNull();
  });
});

describe('parsePlayStoreVersion', () => {
  it('reads the version from the data blob Play embeds', () => {
    expect(parsePlayStoreVersion('...,[[["3.10.2"]],[["other"]]...')).toBe('3.10.2');
  });

  it('falls back to the older markup layout', () => {
    expect(parsePlayStoreVersion('<div>Current Version</div><span>1.4.0</span>')).toBe('1.4.0');
  });

  it.each([
    ['unrecognised markup', '<html><body>no version here</body></html>'],
    ['a "Varies with device" listing', '<div>Current Version</div><span>Varies with device</span>'],
    // The Play page is scraped, so a stray number in the markup is a real
    // hazard: read as a version it would nag every user permanently.
    ['a bare integer', '...,[[["1759276800"]],...'],
    ['an over-long segment', '...,[[["1.20250101"]],...'],
  ])('returns null for %s', (_label, html) => {
    expect(parsePlayStoreVersion(html)).toBeNull();
  });
});

describe('fetchLatestStoreVersion', () => {
  const originalOS = Platform.OS;
  const originalFetch = global.fetch;

  function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  function respondWith(body: string, ok = true, status = 200) {
    const fetchMock = jest.fn().mockResolvedValue({ ok, status, text: async () => body });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  beforeEach(() => {
    mockConfig.current = {
      appStoreId: '1234567890',
      appStoreCountry: 'gb',
      androidPackage: 'com.acme.app',
    };
  });

  afterEach(() => {
    setPlatform(originalOS);
    global.fetch = originalFetch;
  });

  it('queries the configured storefront on iOS', async () => {
    setPlatform('ios');
    const fetchMock = respondWith(JSON.stringify({ results: [{ version: '2.4.1' }] }));

    await expect(fetchLatestStoreVersion()).resolves.toBe('2.4.1');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://itunes.apple.com/lookup?id=1234567890&country=gb'
    );
  });

  it('reads the Play listing on Android', async () => {
    setPlatform('android');
    const fetchMock = respondWith('...,[[["3.10.2"]],...');

    await expect(fetchLatestStoreVersion()).resolves.toBe('3.10.2');
    expect(fetchMock.mock.calls[0][0]).toContain('id=com.acme.app');
  });

  it('skips the lookup entirely on web', async () => {
    setPlatform('web');
    const fetchMock = respondWith('unused');

    await expect(fetchLatestStoreVersion()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'] as const)('returns null on %s when unconfigured', async (os) => {
    setPlatform(os);
    mockConfig.current = { appStoreCountry: 'us' };
    const fetchMock = respondWith('unused');

    await expect(fetchLatestStoreVersion()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on an unparseable payload so the query retries', async () => {
    setPlatform('ios');
    respondWith(JSON.stringify({ results: [] }));

    // A markup or format change must surface as a retryable failure, not be
    // cached as "no update available" for the next six hours.
    await expect(fetchLatestStoreVersion()).rejects.toThrow('no valid version');
  });

  it('throws a named error for a truncated iTunes response', async () => {
    setPlatform('ios');
    respondWith('{"results":[{"vers');

    await expect(fetchLatestStoreVersion()).rejects.toThrow('Invalid JSON response: store-version');
  });

  it('throws on a failed request', async () => {
    setPlatform('android');
    respondWith('', false, 503);

    await expect(fetchLatestStoreVersion()).rejects.toThrow('Request failed (503)');
  });

  it('propagates an aborted caller signal', async () => {
    setPlatform('android');
    const controller = new AbortController();
    controller.abort();
    global.fetch = jest.fn(((_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) return Promise.reject(new Error('Aborted'));
      return Promise.resolve({ ok: true, status: 200, text: async () => '' });
    }) as unknown as typeof fetch);

    await expect(fetchLatestStoreVersion(controller.signal)).rejects.toThrow('Aborted');
  });
});
