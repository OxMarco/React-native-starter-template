import Constants from 'expo-constants';
import { Platform } from 'react-native';

// The running build's identity, and the comparison that decides whether a newer
// one is published. Kept here rather than in the observability layer because
// three unrelated consumers need it: telemetry context, the store-update prompt,
// and the install/update lifecycle events.
//
// Read from `expo-constants` rather than `expo-application` so this works on
// web and in Expo Go too. Both values are frozen into the binary at build time,
// which is exactly the granularity these callers want.

export function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

export function currentBuildVersion(): string {
  if (Platform.OS === 'ios') return Constants.platform?.ios?.buildNumber ?? 'unknown';
  if (Platform.OS === 'android')
    return String(Constants.platform?.android?.versionCode ?? 'unknown');
  return 'web';
}

// Parse a dotted numeric version ("1.2.3") into its segments. Returns null for
// anything not cleanly numeric — a version we cannot understand is better
// skipped than misjudged.
function parseVersion(value: string): number[] | null {
  const parts = value.trim().split('.');
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    numbers.push(Number(part));
  }
  return numbers.length > 0 ? numbers : null;
}

// True only when `latest` is strictly newer than `current`. Missing or garbage
// input (and equal or newer-installed versions) returns false, so a user is
// never nagged to "update" to a version they already have or that we could not
// parse. Pure and dependency-free — the prompt's decision is worth a unit test.
export function isUpdateAvailable(
  current: string | null | undefined,
  latest: string | null | undefined
): boolean {
  if (!current || !latest) return false;
  const installed = parseVersion(current);
  const published = parseVersion(latest);
  if (!installed || !published) return false;

  for (let i = 0; i < Math.max(installed.length, published.length); i++) {
    const a = installed[i] ?? 0;
    const b = published[i] ?? 0;
    if (b > a) return true;
    if (b < a) return false;
  }
  return false;
}
