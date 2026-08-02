import TestRenderer, { act } from 'react-test-renderer';

import RootNavigator from '../RootNavigator';

const mockHideAsync = jest.fn(async () => undefined);
const mockIsOnboardingComplete = jest.fn<Promise<boolean>, []>();
const mockSetOnboardingGateComplete = jest.fn();
const mockCaptureException = jest.fn();
const mockNavigationContainerProps: { current: Record<string, unknown> | null } = { current: null };
const mockStackProps: { current: Record<string, unknown> | null } = { current: null };
const mockNavigationRef = {
  getCurrentRoute: jest.fn(() => undefined),
  getRootState: jest.fn(() => ({ routes: [{ name: 'Welcome' }] })),
  isReady: jest.fn(() => false),
  resetRoot: jest.fn(),
};

jest.mock('expo-splash-screen', () => ({ hideAsync: () => mockHideAsync() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('@react-navigation/native', () => ({
  DarkTheme: { colors: {} },
  DefaultTheme: { colors: {} },
  getStateFromPath: jest.fn(),
  NavigationContainer: (props: Record<string, unknown>) => {
    mockNavigationContainerProps.current = props;
    return props.children;
  },
  useNavigationContainerRef: () => mockNavigationRef,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: (props: Record<string, unknown>) => {
      mockStackProps.current = props;
      return props.children;
    },
    Screen: () => null,
  }),
}));

jest.mock('@/lib/onboarding', () => ({
  isOnboardingComplete: () => mockIsOnboardingComplete(),
}));

jest.mock('@/navigation/linking', () => ({
  linking: { config: {} },
  replayPendingDeepLink: jest.fn(),
  setOnboardingGateComplete: (complete: boolean) => mockSetOnboardingGateComplete(complete),
}));

jest.mock('@/observability/observability', () => ({
  analytics: { screen: jest.fn() },
  errorReporter: {
    captureException: (...args: unknown[]) => mockCaptureException(...args),
  },
}));

jest.mock('@/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    hydrated: true,
    resolvedScheme: 'light',
    theme: {
      primary: '#1d4ed8',
      background: '#ffffff',
      surface: '#ffffff',
      text: '#111827',
      border: '#e5e7eb',
      error: '#dc2626',
    },
  }),
}));

jest.mock('@/components/StartupScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/screens/WelcomeScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../RootTabs', () => ({ __esModule: true, default: () => null }));

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationContainerProps.current = null;
    mockStackProps.current = null;
  });

  it.each([
    [false, 'Welcome'],
    [true, 'Main'],
  ] as const)('starts on %s onboarding state at %s', async (complete, initialRouteName) => {
    mockIsOnboardingComplete.mockResolvedValueOnce(complete);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<RootNavigator />);
    });

    expect(mockSetOnboardingGateComplete).toHaveBeenCalledWith(complete);
    expect(mockStackProps.current?.initialRouteName).toBe(initialRouteName);
    expect(mockNavigationContainerProps.current?.linking).toEqual({ config: {} });
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('fails closed and reports a rejected onboarding read', async () => {
    const error = new Error('storage unavailable');
    mockIsOnboardingComplete.mockRejectedValueOnce(error);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<RootNavigator />);
    });

    expect(mockSetOnboardingGateComplete).toHaveBeenCalledWith(false);
    expect(mockStackProps.current?.initialRouteName).toBe('Welcome');
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      context: 'startup-onboarding-read',
    });
    act(() => renderer.unmount());
  });
});
