import type { ConfigContext, ExpoConfig } from 'expo/config';

const appName = process.env.APP_NAME ?? 'RN Starter';
const slug = process.env.APP_SLUG ?? 'rn-starter';
const scheme = process.env.APP_SCHEME ?? 'rnstarter';
const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER ?? 'com.example.rnstarter';
const androidPackage = process.env.ANDROID_PACKAGE ?? 'com.example.rnstarter';
const easProjectId = process.env.EAS_PROJECT_ID;

if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  (iosBundleIdentifier.startsWith('com.example.') || androidPackage.startsWith('com.example.'))
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
  version: '0.1.0',
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
  plugins: ['expo-status-bar'],
  experiments: {
    tsconfigPaths: true,
  },
  extra: {
    ...config.extra,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
});
