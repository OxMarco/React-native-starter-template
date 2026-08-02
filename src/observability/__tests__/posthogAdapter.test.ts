import type PostHog from 'posthog-react-native';

import { createPostHogAdapter, resetPostHogAdapterForTests } from '../adapters/posthog';

function fakeClient() {
  const calls: string[] = [];
  const client = {
    calls,
    capture: jest.fn(() => {
      calls.push('capture');
    }),
    identify: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn(() => {
      calls.push('reset');
    }),
    optIn: jest.fn(async () => {
      calls.push('optIn');
    }),
    optOut: jest.fn(async () => {
      calls.push('optOut');
    }),
  };
  return client;
}

function adapterFor(client: ReturnType<typeof fakeClient>) {
  const adapter = createPostHogAdapter(client as unknown as PostHog);
  if (!adapter) throw new Error('expected an adapter for a configured client');
  return adapter;
}

describe('PostHog adapter', () => {
  beforeEach(() => resetPostHogAdapterForTests());

  it('is absent when no project token is configured', () => {
    expect(createPostHogAdapter(null)).toBeNull();
  });

  it('captures only after the opt-in has settled', async () => {
    const client = fakeClient();
    const adapter = adapterFor(client);

    void adapter.setEnabled?.(true);
    await adapter.track('app_launched', { launch: 'cold' });

    // Capturing before optIn resolves means the SDK drops the event, which is
    // exactly the window the consent flush lands in.
    expect(client.calls).toEqual(['optIn', 'capture']);
  });

  it('never lands a superseded opt-in after a withdrawal', async () => {
    const client = fakeClient();
    const adapter = adapterFor(client);

    // Toggling faster than optIn/optOut resolve is the case that matters: if a
    // superseded transition still ran, the client would end up in the opposite
    // of what the user chose — here, capturing for someone who opted out.
    void adapter.setEnabled?.(true);
    void adapter.setEnabled?.(false);
    void adapter.setEnabled?.(true);
    await adapter.setEnabled?.(false);

    expect(client.calls.at(-1)).toBe('optOut');
    expect(client.optIn).not.toHaveBeenCalled();
  });

  it('does not opt out when the withdrawal is superseded by a re-grant', async () => {
    const client = fakeClient();
    const adapter = adapterFor(client);

    void adapter.setEnabled?.(true);
    void adapter.setEnabled?.(false);
    await adapter.setEnabled?.(true);

    expect(client.calls.at(-1)).toBe('optIn');
    expect(client.optOut).not.toHaveBeenCalled();
  });

  it('re-asserts consent after a reset', async () => {
    const client = fakeClient();
    const adapter = adapterFor(client);

    await adapter.setEnabled?.(true);
    client.calls.length = 0;
    await adapter.reset?.();

    // `reset()` clears the persisted opt-out flag, which then falls back to
    // `!defaultOptIn` — opted out. Without the re-assert, a logout-time reset
    // silently stops capture for a consenting user.
    expect(client.calls).toEqual(['reset', 'optIn']);
  });

  it('keeps a withdrawal in force across a reset', async () => {
    const client = fakeClient();
    const adapter = adapterFor(client);

    await adapter.setEnabled?.(false);
    client.calls.length = 0;
    await adapter.reset?.();

    expect(client.calls).toEqual(['reset', 'optOut']);
  });

  it('re-asserts the newest choice when consent changes while a reset is queued', async () => {
    const client = fakeClient();
    const adapter = adapterFor(client);

    await adapter.setEnabled?.(true);
    void adapter.setEnabled?.(false);
    void adapter.reset?.();
    // The re-grant lands before the queued reset runs. The reset must apply the
    // choice in force when it executes, not the one that was current when it was
    // queued — otherwise it opts out a user who has just consented again.
    await adapter.setEnabled?.(true);

    expect(client.calls.at(-1)).toBe('optIn');
    expect(client.optOut).not.toHaveBeenCalled();
  });
});
