import AsyncStorage from '@react-native-async-storage/async-storage';

import { isOnboardingComplete, markOnboardingComplete, resetOnboarding } from '../onboarding';

describe('onboarding', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists and resets completion', async () => {
    await expect(isOnboardingComplete()).resolves.toBe(false);
    await markOnboardingComplete();
    await expect(isOnboardingComplete()).resolves.toBe(true);
    await resetOnboarding();
    await expect(isOnboardingComplete()).resolves.toBe(false);
  });
});
