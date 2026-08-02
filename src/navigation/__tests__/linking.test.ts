import { Linking } from 'react-native';

import {
  linking,
  replayPendingDeepLink,
  resetPendingDeepLink,
  setOnboardingGateComplete,
} from '../linking';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { scheme: 'rnstarter' } },
}));

const DEEP_LINK = 'rnstarter://settings';

// The url handler reads onboarding state from AsyncStorage before deciding, so
// the assertion has to wait for that promise chain to drain.
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

let urlListener: ((event: { url: string }) => void) | null = null;

beforeEach(() => {
  jest.restoreAllMocks();
  resetPendingDeepLink();
  urlListener = null;

  jest.spyOn(Linking, 'addEventListener').mockImplementation((type, listener) => {
    if (type === 'url') urlListener = listener as (event: { url: string }) => void;
    // Only `remove` is exercised here; the rest of EmitterSubscription is
    // internal to the real emitter and never touched by the linking config.
    return { remove: jest.fn() } as unknown as ReturnType<typeof Linking.addEventListener>;
  });
});

describe('deep link onboarding gate', () => {
  it('delivers a cold-start link once onboarding is complete', async () => {
    setOnboardingGateComplete(true);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(DEEP_LINK);

    await expect(linking.getInitialURL?.()).resolves.toBe(DEEP_LINK);
  });

  it('parks a cold-start link that would otherwise skip onboarding', async () => {
    // Regression guard: React Navigation builds the initial state straight from
    // this URL, so returning it on a fresh install bypasses the Welcome gate.
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(DEEP_LINK);

    await expect(linking.getInitialURL?.()).resolves.toBeNull();
  });

  it('replays the parked link only after onboarding is left behind', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(DEEP_LINK);
    await linking.getInitialURL?.();

    const listener = jest.fn();
    linking.subscribe?.(listener);

    replayPendingDeepLink('Welcome');
    expect(listener).not.toHaveBeenCalled();

    replayPendingDeepLink('Main');
    expect(listener).toHaveBeenCalledWith(DEEP_LINK);
  });

  it('replays a parked link exactly once', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(DEEP_LINK);
    await linking.getInitialURL?.();

    const listener = jest.fn();
    linking.subscribe?.(listener);

    replayPendingDeepLink('Main');
    replayPendingDeepLink('Main');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('parks a warm link that arrives during onboarding', async () => {
    const listener = jest.fn();
    linking.subscribe?.(listener);

    urlListener?.({ url: DEEP_LINK });
    await flushAsync();

    expect(listener).not.toHaveBeenCalled();

    replayPendingDeepLink('Main');
    expect(listener).toHaveBeenCalledWith(DEEP_LINK);
  });

  it('passes a warm link straight through after onboarding', async () => {
    setOnboardingGateComplete(true);
    const listener = jest.fn();
    linking.subscribe?.(listener);

    urlListener?.({ url: DEEP_LINK });
    await flushAsync();

    expect(listener).toHaveBeenCalledWith(DEEP_LINK);
  });

  it('derives its prefixes from the configured scheme', () => {
    expect(linking.prefixes).toEqual(['rnstarter://']);
  });

  it('parks a web path instead of constructing navigation state before onboarding', () => {
    expect(linking.getStateFromPath?.('/settings', linking.config)).toBeUndefined();

    const handleWebPath = jest.fn();
    replayPendingDeepLink('Welcome', handleWebPath);
    expect(handleWebPath).not.toHaveBeenCalled();

    replayPendingDeepLink('Main', handleWebPath);
    expect(handleWebPath).toHaveBeenCalledWith('/settings');
  });

  it('constructs web navigation state after onboarding', () => {
    setOnboardingGateComplete(true);

    expect(linking.getStateFromPath?.('/settings', linking.config)).toMatchObject({
      routes: [{ name: 'Main', state: { routes: [{ name: 'Settings' }] } }],
    });
  });
});
