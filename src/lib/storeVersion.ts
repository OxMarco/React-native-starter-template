import { Platform } from 'react-native';

import { errorReporter } from '@/observability/observability';

import { getAppConfig } from './appConfig';

// Resolves the latest published native version straight from the app stores,
// on-device, with no backend involved. `StoreUpdatePrompt` compares it against
// the installed binary to nudge users on an older build. React Native's fetch is
// not CORS-bound, so the app can read Apple's and Google's public listings
// directly.
//
// iOS is clean: Apple's iTunes lookup API returns the listing as JSON, no auth.
// Android has no public version API, so the Play page is scraped. The pure
// parsers return null for unrecognised payloads, but the network lookup throws
// in that case, so the query layer retries and the failure is visible as a
// markup change rather than silently cached as "no update".

// A published version is major.minor(.patch(.build)) — at least two dotted
// numeric segments, each of sane magnitude. Requiring the dot and bounding each
// segment to four digits is deliberate: the best-effort Play scrape can pick up
// a stray number from the page, and a lone integer or an epoch-like value
// mistaken for a "much newer" version would nag a user who is already current.
// Anything failing this is rejected as null so the fetch path can retry. The
// iOS lookup is authoritative and always satisfies it anyway.
const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){1,3}$/;

const LOOKUP_TIMEOUT_MS = 10_000;
let reportedInvalidStoreJson = false;

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value.trim());
}

// `results[0].version` from the iTunes lookup payload is the currently published
// App Store version. Defensive about shape — the endpoint is public and its JSON
// is not something this project controls.
export function parseAppStoreVersion(json: unknown): string | null {
  const results = (json as { results?: unknown } | null)?.results;
  const first = Array.isArray(results) ? results[0] : undefined;
  const version = (first as { version?: unknown } | undefined)?.version;
  return isVersion(version) ? version.trim() : null;
}

// The Play details page embeds the version in a data blob; match the first
// dotted numeric string in the shape Play emits, with an older-markup fallback.
// Best-effort by nature — Google reshuffles this markup periodically and many
// listings report "Varies with device" (no version at all) — so null is an
// expected parser outcome that the network lookup turns into a retryable error.
export function parsePlayStoreVersion(html: string): string | null {
  const match =
    /\[\[\["(\d+(?:\.\d+)+)"\]\]/.exec(html) ?? /Current Version[\s\S]*?>([\d.]+)</.exec(html);
  const version = match?.[1];
  return isVersion(version) ? version.trim() : null;
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed (${response.status}): store-version`);
    return await response.text();
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
    clearTimeout(timer);
  }
}

/**
 * Returns the latest version published for the current platform, or null when
 * this platform has no store lookup (web) or the app's store identity has not
 * been configured yet. Throws on a failed or unparseable lookup so the caller
 * can retry.
 */
export async function fetchLatestStoreVersion(signal?: AbortSignal): Promise<string | null> {
  const { appStoreId, appStoreCountry, androidPackage } = getAppConfig();

  if (Platform.OS === 'ios') {
    if (!appStoreId) return null;
    const url = `https://itunes.apple.com/lookup?id=${appStoreId}&country=${appStoreCountry}`;
    const text = await fetchText(url, signal);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // A truncated iTunes response is a transport blip, not a markup change.
      // Rethrow with a message that names the lookup, unlike the bare
      // SyntaxError, and report it once per launch so a genuine format change
      // is still visible without flooding the reporter on a flaky network.
      if (!reportedInvalidStoreJson) {
        reportedInvalidStoreJson = true;
        errorReporter.captureMessage('App Store lookup returned invalid JSON', {
          context: 'store-version-invalid-json',
        });
      }
      throw new Error('Invalid JSON response: store-version');
    }
    const version = parseAppStoreVersion(json);
    if (!version) throw new Error('App Store lookup returned no valid version');
    return version;
  }

  if (Platform.OS === 'android') {
    if (!androidPackage) return null;
    const url = `https://play.google.com/store/apps/details?id=${androidPackage}&hl=en_US`;
    const version = parsePlayStoreVersion(await fetchText(url, signal));
    if (!version) throw new Error('Play Store lookup returned no valid version');
    return version;
  }

  return null;
}
