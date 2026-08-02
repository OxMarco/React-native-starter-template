import Constants from 'expo-constants';

// Runtime read of the non-secret values `app.config.ts` publishes under `extra`.
//
// `extra` is the one channel that carries build-time configuration into the
// bundle without an `EXPO_PUBLIC_` variable at every call site, so it is where
// the vendor DSNs and store identifiers live. Everything here is embedded in
// the shipped binary and readable by anyone who unpacks it — a Sentry DSN and a
// PostHog project token are write-only public keys, which is why they are safe
// here. A private API key never is.
//
// Every field is optional on purpose: the starter has to boot with none of them
// set. Each consumer degrades to "feature off" rather than throwing, so a fresh
// clone runs before any vendor account exists.

type AppExtra = {
  sentryDsn?: unknown;
  sentrySendDefaultPii?: unknown;
  posthogApiKey?: unknown;
  posthogHost?: unknown;
  appStoreId?: unknown;
  appStoreCountry?: unknown;
  androidPackage?: unknown;
};

function extra(): AppExtra {
  return (Constants.expoConfig?.extra ?? {}) as AppExtra;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export type AppConfig = {
  sentryDsn?: string;
  // Sentry's `sendDefaultPii` attaches the IP address and request headers of the
  // reporting device. Off unless explicitly enabled, so the default posture is
  // the one that needs no privacy-policy change.
  sentrySendDefaultPii: boolean;
  posthogApiKey?: string;
  posthogHost: string;
  // App Store numeric id and Play application id, used by the on-device
  // "update available" lookup. Absent means that platform's check is skipped.
  appStoreId?: string;
  appStoreCountry: string;
  androidPackage?: string;
};

export const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
// Apple's lookup API answers per storefront and a release can reach one region
// before another. `us` is the broadest default; set APP_STORE_COUNTRY when the
// app targets a single market, or the prompt can fire early or stay silent.
export const DEFAULT_APP_STORE_COUNTRY = 'us';

export function getAppConfig(): AppConfig {
  const values = extra();
  return {
    sentryDsn: readString(values.sentryDsn),
    sentrySendDefaultPii: values.sentrySendDefaultPii === true,
    posthogApiKey: readString(values.posthogApiKey),
    posthogHost: readString(values.posthogHost) ?? DEFAULT_POSTHOG_HOST,
    appStoreId: readString(values.appStoreId),
    appStoreCountry: readString(values.appStoreCountry) ?? DEFAULT_APP_STORE_COUNTRY,
    androidPackage: readString(values.androidPackage),
  };
}

export function appStoreUrl(config: AppConfig = getAppConfig()): string | null {
  return config.appStoreId ? `https://apps.apple.com/app/id${config.appStoreId}` : null;
}

export function playStoreUrl(config: AppConfig = getAppConfig()): string | null {
  return config.androidPackage
    ? `https://play.google.com/store/apps/details?id=${config.androidPackage}`
    : null;
}
