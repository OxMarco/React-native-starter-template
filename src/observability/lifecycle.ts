import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, type NativeEventSubscription } from 'react-native';

import { currentAppVersion, currentBuildVersion } from '@/lib/appVersion';
import { isOnboardingComplete } from '@/lib/onboarding';

import { analytics } from './observability';

// Install, update, and foreground/background events, tracked here rather than
// through an SDK's built-in lifecycle capture.
//
// Every analytics SDK offers this, and using theirs is a trap in two ways: it
// fires during SDK construction, before the stored consent has been read, and
// it keys "is this a new build?" off a version marker the SDK persists for its
// own purposes. Owning both means these events obey consent like every other
// event and agree with the version identity the rest of the app reports.
const LIFECYCLE_STORAGE_KEY = 'starter:lifecycle:v1';

type LifecycleMarker = {
  appBuild: string | null;
  appVersion: string | null;
};

let listenerStarted = false;
let launchCaptured = false;
let appStateSubscription: NativeEventSubscription | null = null;

function currentMarker(): LifecycleMarker {
  const build = currentBuildVersion();
  const version = currentAppVersion();
  return {
    appBuild: build === 'unknown' ? null : build,
    appVersion: version === 'unknown' ? null : version,
  };
}

async function readMarker(): Promise<LifecycleMarker | null> {
  try {
    const raw = await AsyncStorage.getItem(LIFECYCLE_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<LifecycleMarker>;
    return {
      appBuild: typeof parsed.appBuild === 'string' ? parsed.appBuild : null,
      appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : null,
    };
  } catch {
    // A missing or unreadable marker is indistinguishable from a fresh install
    // here, and the onboarding guard below is what keeps that from being
    // reported as one.
    return null;
  }
}

async function writeMarker(marker: LifecycleMarker): Promise<void> {
  try {
    await AsyncStorage.setItem(LIFECYCLE_STORAGE_KEY, JSON.stringify(marker));
  } catch {
    // Best-effort. Losing the marker costs at most one duplicate `app_updated`
    // on the next launch, which is not worth failing startup over.
  }
}

// The launching deep link is worth knowing — which entry points people actually
// arrive through is otherwise invisible — but the raw URL must never be sent.
// Query strings are where magic-link tokens, password-reset codes, OAuth
// authorization codes, and invite identifiers all live, and `sanitizeProperties`
// only redacts by property NAME, so a URL under the key `url` would pass through
// untouched and land in analytics verbatim.
//
// Keep the scheme, host, and path; drop the query, the fragment, and any
// `user:pass@` userinfo. Path segments are the residual risk — an app that puts
// a secret in the path (`myapp://reset/<token>`) needs to shorten this further,
// because nothing here can tell an id from a route.
//
// Parsed by hand rather than with `new URL()`: Hermes' URL implementation is
// incomplete and behaves differently across platforms, and this runs on the
// launch path where a throw would cost the whole lifecycle capture.
export function sanitizeLaunchUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const [withoutParams] = url.trim().split(/[?#]/);
  // RFC 3986 authority: everything up to the first `@` is userinfo.
  const sanitized = withoutParams.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^/]*@/, '$1');
  return sanitized.length > 0 ? sanitized : null;
}

async function initialUrl(): Promise<string | null> {
  try {
    return sanitizeLaunchUrl(await Linking.getInitialURL());
  } catch {
    return null;
  }
}

export async function captureLaunchLifecycle(): Promise<void> {
  const current = currentMarker();
  const previous = await readMarker();

  if (current.appBuild) {
    if (!previous?.appBuild) {
      // No stored marker means either a genuine fresh install or an existing
      // user updating to the first build that writes one. Only the former has
      // not onboarded yet — without this guard, shipping this file would
      // retro-fire an install for the entire active user base on release day.
      // The marker is written below either way, so this only ever matters on
      // the first launch of the build that introduces it.
      if (!(await isOnboardingComplete())) analytics.track('app_installed', {});
    } else if (previous.appBuild !== current.appBuild) {
      analytics.track('app_updated', {
        previous_version: previous.appVersion ?? 'unknown',
        previous_build: previous.appBuild,
      });
    }
  }

  analytics.track('app_opened', { url: await initialUrl() });

  if (current.appBuild || current.appVersion) await writeMarker(current);
}

/**
 * Starts lifecycle tracking. Safe to call repeatedly — the launch events fire
 * once per process and the AppState listener is installed once.
 */
export async function startLifecycleTracking(): Promise<void> {
  if (!listenerStarted) {
    listenerStarted = true;
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') analytics.track('app_became_active', {});
      else if (state === 'background') analytics.track('app_backgrounded', {});
    });
  }

  if (launchCaptured) return;
  launchCaptured = true;
  await captureLaunchLifecycle();
}

export function stopLifecycleTracking(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
  listenerStarted = false;
}

export function resetLifecycleTrackingForTests(): void {
  stopLifecycleTracking();
  launchCaptured = false;
}
