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
