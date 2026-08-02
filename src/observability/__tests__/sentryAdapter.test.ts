import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';

import { analyticsConsentSetting } from '../analyticsConsent';
import { initSentry, sentryErrorReporter } from '../adapters/sentry';

const mockExtra: { current: Record<string, unknown> } = { current: {} };

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra.current };
    },
  },
}));

const init = Sentry.init as jest.Mock;

function initOptions() {
  return init.mock.calls.at(-1)?.[0] as Parameters<typeof Sentry.init>[0];
}

async function sendEvent(): Promise<ErrorEvent | null> {
  const beforeSend = initOptions()?.beforeSend;
  if (!beforeSend) throw new Error('expected a beforeSend hook');
  const event = { user: { id: 'user-1', ip_address: '1.2.3.4' } } as ErrorEvent;
  return (await beforeSend(event, {})) ?? null;
}

describe('Sentry adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtra.current = {};
  });

  it('initialises disabled when no DSN is configured', () => {
    initSentry();

    // Initialising disabled rather than skipping keeps every downstream
    // `Sentry.*` call a valid no-op instead of a crash on an uninitialised
    // client, so an unconfigured clone of the starter still runs.
    expect(init).toHaveBeenCalledTimes(1);
    expect(initOptions()).toMatchObject({ dsn: undefined, enabled: false });
  });

  it('keeps PII off unless it is explicitly turned on', () => {
    mockExtra.current = { sentryDsn: 'https://public@o1.ingest.sentry.io/2' };
    initSentry();
    expect(initOptions()).toMatchObject({ sendDefaultPii: false });

    mockExtra.current = {
      sentryDsn: 'https://public@o1.ingest.sentry.io/2',
      sentrySendDefaultPii: true,
    };
    initSentry();
    expect(initOptions()).toMatchObject({ sendDefaultPii: true });
  });

  it('drops every event while analytics consent is withdrawn', async () => {
    await analyticsConsentSetting.set('denied');
    initSentry();

    await expect(sendEvent()).resolves.toBeNull();
  });

  it('strips user identity from events it does send', async () => {
    await analyticsConsentSetting.set('granted');
    initSentry();

    const event = await sendEvent();

    // Data minimisation regardless of `sendDefaultPii`: a dependency that
    // populated `user` must not be able to widen what this app transmits.
    expect(event).not.toBeNull();
    expect(event?.user).toBeUndefined();
  });

  it('maps the reporter context onto Sentry tags', () => {
    sentryErrorReporter.captureException(new Error('boom'), {
      context: 'query-cache',
      tags: { kind: 'server' },
      extra: { retryable: true },
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { kind: 'server', context: 'query-cache' },
      extra: { retryable: true },
    });
  });
});
