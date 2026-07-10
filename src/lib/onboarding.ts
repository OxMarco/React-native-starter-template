import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'starter:onboarding-complete:v1';

export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}
