import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

import { markOnboardingComplete, resetOnboarding } from '@/lib/onboarding';

import {
  captureLaunchLifecycle,
  resetLifecycleTrackingForTests,
  sanitizeLaunchUrl,
} from '../lifecycle';
import { analytics } from '../observability';

jest.mock('@/lib/appVersion', () => ({
  currentAppVersion: () => '2.0.0',
  currentBuildVersion: () => '42',
}));

const track = jest.spyOn(analytics, 'track');

const LIFECYCLE_KEY = 'starter:lifecycle:v1';

describe('launch lifecycle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetLifecycleTrackingForTests();
    await AsyncStorage.clear();
    await resetOnboarding();
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  });

  it('reports an install on a first launch that has not onboarded', async () => {
    await captureLaunchLifecycle();

    expect(track).toHaveBeenCalledWith('app_installed', {});
    expect(track).toHaveBeenCalledWith('app_opened', { url: null });
    expect(await AsyncStorage.getItem(LIFECYCLE_KEY)).toBe(
      JSON.stringify({ appBuild: '42', appVersion: '2.0.0' })
    );
  });

  it('does not report an install for an existing user meeting the marker for the first time', async () => {
    // The build that introduces the marker would otherwise retro-fire an
    // install for the entire active user base on release day.
    await markOnboardingComplete();

    await captureLaunchLifecycle();

    expect(track).not.toHaveBeenCalledWith('app_installed', {});
    expect(track).toHaveBeenCalledWith('app_opened', { url: null });
  });

  it('reports an update when the stored build differs', async () => {
    await AsyncStorage.setItem(
      LIFECYCLE_KEY,
      JSON.stringify({ appBuild: '41', appVersion: '1.9.0' })
    );

    await captureLaunchLifecycle();

    expect(track).toHaveBeenCalledWith('app_updated', {
      previous_version: '1.9.0',
      previous_build: '41',
    });
  });

  it('reports neither install nor update when the build is unchanged', async () => {
    await AsyncStorage.setItem(
      LIFECYCLE_KEY,
      JSON.stringify({ appBuild: '42', appVersion: '2.0.0' })
    );

    await captureLaunchLifecycle();

    expect(track).not.toHaveBeenCalledWith('app_installed', {});
    expect(track).not.toHaveBeenCalledWith('app_updated', expect.anything());
    expect(track).toHaveBeenCalledWith('app_opened', { url: null });
  });

  it('attaches the launching deep link to app_opened', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('rnstarter://home');
    await markOnboardingComplete();

    await captureLaunchLifecycle();

    expect(track).toHaveBeenCalledWith('app_opened', { url: 'rnstarter://home' });
  });

  it('never sends the query string of a launching link to analytics', async () => {
    // A magic link, a password reset, and an OAuth callback all arrive this way.
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('rnstarter://auth?token=secret-value&email=user@example.com');
    await markOnboardingComplete();

    await captureLaunchLifecycle();

    expect(track).toHaveBeenCalledWith('app_opened', { url: 'rnstarter://auth' });
  });
});

describe('sanitizeLaunchUrl', () => {
  it.each([
    ['https://example.com/reset?token=abc#fragment', 'https://example.com/reset'],
    ['rnstarter://invite#code=abc', 'rnstarter://invite'],
    ['https://user:pass@example.com/orders', 'https://example.com/orders'],
    ['  rnstarter://home  ', 'rnstarter://home'],
  ])('reduces %s to %s', (raw, expected) => {
    expect(sanitizeLaunchUrl(raw)).toBe(expected);
  });

  it.each([null, undefined, '', '   ', '?token=abc'])('treats %p as no link', (raw) => {
    expect(sanitizeLaunchUrl(raw)).toBeNull();
  });

  it('survives a corrupt marker without reporting a false install', async () => {
    await markOnboardingComplete();
    await AsyncStorage.setItem(LIFECYCLE_KEY, 'not json');

    await expect(captureLaunchLifecycle()).resolves.toBeUndefined();

    expect(track).not.toHaveBeenCalledWith('app_installed', {});
  });
});
