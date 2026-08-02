import {
  getStateFromPath as getStateFromPathDefault,
  type LinkingOptions,
} from '@react-navigation/native';
import Constants from 'expo-constants';
import { Linking } from 'react-native';

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
type PendingDeepLink = { kind: 'url'; value: string } | { kind: 'path'; value: string };

let onboardingComplete = false;
let pendingDeepLink: PendingDeepLink | null = null;
let deepLinkListener: ((url: string) => void) | null = null;

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
    if (onboardingComplete) return url;

    pendingDeepLink = { kind: 'url', value: url };
    return null;
  },
  subscribe: (listener) => {
    deepLinkListener = listener;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (onboardingComplete) listener(url);
      else pendingDeepLink = { kind: 'url', value: url };
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
  // React Navigation's web implementation reads window.location directly and
  // does not call getInitialURL/subscribe. Gate getStateFromPath as well so a
  // fresh browser URL cannot construct a state beyond onboarding.
  getStateFromPath: (path, options) => {
    const state = getStateFromPathDefault(path, options);
    if (onboardingComplete || !state) return state;

    pendingDeepLink = { kind: 'path', value: path };
    return undefined;
  },
};

export function setOnboardingGateComplete(complete: boolean) {
  onboardingComplete = complete;
}

// Called on every navigation state change. Onboarding ends by replacing the
// route with Main, which is the signal that a parked link can be delivered.
export function replayPendingDeepLink(
  routeName: string | undefined,
  handleWebPath?: (path: string) => void
) {
  if (!pendingDeepLink || !routeName || ONBOARDING_ROUTES.includes(routeName)) return;

  const pending = pendingDeepLink;
  pendingDeepLink = null;
  if (pending.kind === 'path') handleWebPath?.(pending.value);
  else deepLinkListener?.(pending.value);
}

// Exposed for tests; module state otherwise leaks between cases.
export function resetPendingDeepLink() {
  onboardingComplete = false;
  pendingDeepLink = null;
  deepLinkListener = null;
}
