import type { LinkingOptions } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Linking } from 'react-native';

import { isOnboardingComplete } from '@/lib/onboarding';
import { errorReporter } from '@/observability/observability';

import type { RootStackParamList } from './RootNavigator';

// Routes that mean "onboarding has not finished". A parked link must not
// navigate away from these, or it skips the remaining steps.
const ONBOARDING_ROUTES = ['Welcome'];

// Deep links must not bypass onboarding. With the default linking behaviour a
// cold-start URL on a fresh install builds the initial navigation state
// straight onto its target, so the Welcome gate — and anything it is
// responsible for, such as accepting terms — never runs at all.
//
// The fix is to park any URL that arrives before onboarding completes and
// replay it once the navigator has left the onboarding screens.
let pendingUrl: string | null = null;
let deepLinkListener: ((url: string) => void) | null = null;

function reportOnboardingReadFailure(context: string) {
  return (error: unknown) => {
    errorReporter.captureException(error, { context });
    // Treat an unreadable flag as "not onboarded": showing onboarding twice is
    // recoverable, silently skipping it is not.
    return false;
  };
}

function schemePrefixes(): string[] {
  const scheme = Constants.expoConfig?.scheme;
  const schemes = Array.isArray(scheme) ? scheme : scheme ? [scheme] : [];
  return schemes.map((value) => `${value}://`);
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: schemePrefixes(),
  getInitialURL: async () => {
    const url = await Linking.getInitialURL();
    if (!url) return null;

    const complete = await isOnboardingComplete().catch(
      reportOnboardingReadFailure('linking-initial-onboarding-read')
    );
    if (complete) return url;

    pendingUrl = url;
    return null;
  },
  subscribe: (listener) => {
    deepLinkListener = listener;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void isOnboardingComplete()
        .catch(reportOnboardingReadFailure('linking-event-onboarding-read'))
        .then((complete) => {
          if (complete) listener(url);
          else pendingUrl = url;
        });
    });

    return () => {
      deepLinkListener = null;
      subscription.remove();
    };
  },
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Settings: 'settings',
        },
      },
    },
  },
};

// Called on every navigation state change. Onboarding ends by replacing the
// route with Main, which is the signal that a parked link can be delivered.
export function replayPendingDeepLink(routeName: string | undefined) {
  if (!pendingUrl || !routeName || ONBOARDING_ROUTES.includes(routeName)) return;

  const url = pendingUrl;
  pendingUrl = null;
  deepLinkListener?.(url);
}

// Exposed for tests; module state otherwise leaks between cases.
export function resetPendingDeepLink() {
  pendingUrl = null;
  deepLinkListener = null;
}
