import type { ConfigContext, ExpoConfig } from 'expo/config';

import { version } from './package.json';

const PLACEHOLDER_PREFIX = 'com.example.';

const appName = process.env.APP_NAME ?? 'RN Starter';
const slug = process.env.APP_SLUG ?? 'rn-starter';
const scheme = process.env.APP_SCHEME ?? 'rnstarter';
const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER ?? `${PLACEHOLDER_PREFIX}rnstarter`;
const androidPackage = process.env.ANDROID_PACKAGE ?? `${PLACEHOLDER_PREFIX}rnstarter`;
const easProjectId = process.env.EAS_PROJECT_ID;

// `npm run init` writes app identity to .env.local, which .gitignore excludes.
// EAS Build uploads the git-tracked project, so it never sees that file and
// every value here silently falls back to its placeholder — the identifiers,
// but also the app name and the deep-link scheme, which fail quietly rather
// than loudly. Identity has to be set again as EAS environment variables.
//
// Checked before the placeholder test so the message names the actual fix
// instead of pointing at identifiers the developer already replaced locally.
if (process.env.EAS_BUILD === 'true' && !process.env.IOS_BUNDLE_IDENTIFIER) {
  throw new Error(
    'App identity is missing from the EAS build environment. EAS does not read .env.local — ' +
      'publish the same values with `eas env:create` (APP_NAME, APP_SLUG, APP_SCHEME, ' +
      'IOS_BUNDLE_IDENTIFIER, ANDROID_PACKAGE) or set them under `build.<profile>.env` in eas.json.'
  );
}

if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  (iosBundleIdentifier.startsWith(PLACEHOLDER_PREFIX) ||
    androidPackage.startsWith(PLACEHOLDER_PREFIX))
) {
  throw new Error(
    'Replace the placeholder iOS and Android identifiers before creating a production build.'
  );
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
  plugins: ['expo-status-bar', 'expo-splash-screen'],
  experiments: {
    tsconfigPaths: true,
  },
  extra: {
    ...config.extra,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
});
