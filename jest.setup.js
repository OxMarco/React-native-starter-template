jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () => {
  const netInfo = {
    addEventListener: jest.fn(() => jest.fn()),
  };

  return {
    __esModule: true,
    default: netInfo,
    useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
  };
});

// The vendor SDKs are mocked globally rather than per-test. Both ship native
// modules and both do real work at import time — Sentry installs global error
// handlers, PostHog opens storage and starts a flush timer — which would leak
// across the suite and leave open handles behind. Tests that need to assert on
// these calls re-mock them locally with their own spies.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    optIn: jest.fn().mockResolvedValue(undefined),
    optOut: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  hasAction: jest.fn().mockResolvedValue(false),
  requestReview: jest.fn().mockResolvedValue(undefined),
}));
