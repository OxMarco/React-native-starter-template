import type { ConfigContext, ExpoConfig } from 'expo/config';

import { version } from './package.json';

const PLACEHOLDER_PREFIX = 'com.example.';
const PLACEHOLDER_IDENTITY = {
  APP_NAME: 'RN Starter',
  APP_SLUG: 'rn-starter',
  APP_SCHEME: 'rnstarter',
  IOS_BUNDLE_IDENTIFIER: `${PLACEHOLDER_PREFIX}rnstarter`,
  ANDROID_PACKAGE: `${PLACEHOLDER_PREFIX}rnstarter`,
} as const;

const appName = process.env.APP_NAME ?? PLACEHOLDER_IDENTITY.APP_NAME;
const slug = process.env.APP_SLUG ?? PLACEHOLDER_IDENTITY.APP_SLUG;
const scheme = process.env.APP_SCHEME ?? PLACEHOLDER_IDENTITY.APP_SCHEME;
const iosBundleIdentifier =
  process.env.IOS_BUNDLE_IDENTIFIER ?? PLACEHOLDER_IDENTITY.IOS_BUNDLE_IDENTIFIER;
const androidPackage = process.env.ANDROID_PACKAGE ?? PLACEHOLDER_IDENTITY.ANDROID_PACKAGE;
const easProjectId = process.env.EAS_PROJECT_ID ?? process.env.EAS_BUILD_PROJECT_ID;

// `npm run init` writes app identity to .env.local, which .gitignore excludes.
// EAS Build uploads the git-tracked project, so it never sees that file and
// every value here silently falls back to its placeholder — the identifiers,
// but also the app name and the deep-link scheme, which fail quietly rather
// than loudly. Identity has to be set again as EAS environment variables.
//
// Checked before the placeholder test so the message names the actual fix
// instead of pointing at identifiers the developer already replaced locally.
const identityEnvironment = {
  APP_NAME: process.env.APP_NAME,
  APP_SLUG: process.env.APP_SLUG,
  APP_SCHEME: process.env.APP_SCHEME,
  IOS_BUNDLE_IDENTIFIER: process.env.IOS_BUNDLE_IDENTIFIER,
  ANDROID_PACKAGE: process.env.ANDROID_PACKAGE,
};
const missingIdentity = Object.entries(identityEnvironment)
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);

if (process.env.EAS_BUILD === 'true' && missingIdentity.length > 0) {
  throw new Error(
    `App identity is missing from the EAS build environment: ${missingIdentity.join(', ')}. ` +
      'EAS does not read .env.local — publish these values with `eas env:create` or set them ' +
      'under `build.<profile>.env` in eas.json.'
  );
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  throw new Error(`APP_SLUG is invalid: "${slug}".`);
}
if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
  throw new Error(`APP_SCHEME is invalid: "${scheme}".`);
}
const applicationIdPattern = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
if (!applicationIdPattern.test(iosBundleIdentifier) || !applicationIdPattern.test(androidPackage)) {
  throw new Error(
    'IOS_BUNDLE_IDENTIFIER and ANDROID_PACKAGE must be valid application identifiers.'
  );
}

if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  Object.entries({
    APP_NAME: appName,
    APP_SLUG: slug,
    APP_SCHEME: scheme,
    IOS_BUNDLE_IDENTIFIER: iosBundleIdentifier,
    ANDROID_PACKAGE: androidPackage,
  }).some(
    ([key, value]) => value === PLACEHOLDER_IDENTITY[key as keyof typeof PLACEHOLDER_IDENTITY]
  )
) {
  throw new Error('Replace every starter identity placeholder before creating a production build.');
}

// Observability and store-listing configuration. All optional: with none of it
// set the SDKs initialise disabled and the update prompt stays silent, so a
// fresh clone runs before any vendor account exists.
const sentryDsn = process.env.SENTRY_DSN?.trim();
const sentryOrganization = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
const sentrySendDefaultPii = process.env.SENTRY_SEND_DEFAULT_PII === 'true';
const posthogApiKey = process.env.POSTHOG_API_KEY?.trim();
const posthogHost = process.env.POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';
const appStoreId = process.env.APP_STORE_ID?.trim();
const appStoreCountry = process.env.APP_STORE_COUNTRY?.trim() || 'us';

// The Sentry plugin uploads source maps at build time, which needs an org, a
// project, and SENTRY_AUTH_TOKEN in the build environment. Added only when the
// org and project are known — including it unconfigured fails prebuild rather
// than degrading to "no source maps".
const sentryPlugin: ExpoConfig['plugins'] =
  sentryOrganization && sentryProject
    ? [['@sentry/react-native/expo', { organization: sentryOrganization, project: sentryProject }]]
    : [];

// Unsymbolicated crash reports are close to useless, and a production build is
// the one place that cannot be re-run locally to find out what happened. Warn
// rather than throw: a team that has not adopted Sentry yet must still be able
// to ship.
if (process.env.EAS_BUILD_PROFILE === 'production') {
  if (sentryDsn && !(sentryOrganization && sentryProject && process.env.SENTRY_AUTH_TOKEN)) {
    console.warn(
      '[build] SENTRY_DSN is set but SENTRY_ORG, SENTRY_PROJECT, or SENTRY_AUTH_TOKEN is missing — ' +
        'source maps will not upload and crash reports will be unsymbolicated.'
    );
  }
  if (!appStoreId) {
    console.warn(
      '[build] APP_STORE_ID is not set — the iOS "update available" prompt cannot look up the ' +
        'published version and will never appear.'
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName,
  slug,
  scheme,
  // Single source of truth: EAS owns the build number (`appVersionSource:
  // remote`), package.json owns the marketing version.
  version,
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: iosBundleIdentifier,
  },
  android: {
    package: androidPackage,
  },
  web: {
    bundler: 'metro',
  },
  // expo-store-review ships no config plugin — listing it makes Expo try to
  // load the module itself as one, which fails config resolution outright.
  plugins: ['expo-status-bar', 'expo-splash-screen', ...sentryPlugin],
  experiments: {
    tsconfigPaths: true,
  },
  extra: {
    ...config.extra,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    // Non-secret runtime configuration, read back through `src/lib/appConfig.ts`.
    // Everything here is embedded in the shipped bundle and readable by anyone
    // who unpacks the binary — a Sentry DSN and a PostHog project token are
    // write-only public keys, which is why they are safe to publish this way.
    // A private API key never is.
    ...(sentryDsn ? { sentryDsn } : {}),
    sentrySendDefaultPii,
    ...(posthogApiKey ? { posthogApiKey } : {}),
    posthogHost,
    ...(appStoreId ? { appStoreId } : {}),
    appStoreCountry,
    // Mirrored into `extra` so the on-device Play Store version lookup can read
    // it at runtime; `android.package` itself is not exposed to the bundle.
    androidPackage,
  },
});
