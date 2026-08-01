import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import StartupScreen from '@/components/StartupScreen';
import { isOnboardingComplete } from '@/lib/onboarding';
import { analytics } from '@/observability/observability';
import { useAppTheme } from '@/providers/ThemeProvider';
import WelcomeScreen from '@/screens/WelcomeScreen';

import { linking, replayPendingDeepLink } from './linking';
import RootTabs from './RootTabs';

export type RootStackParamList = {
  Welcome: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Startup waits on two AsyncStorage reads. Neither is guaranteed to settle: a
// corrupt store or a wedged native module leaves the promise pending forever
// and the app sits on the splash with no way out. Cap the wait and start with
// defaults instead — showing onboarding again is recoverable, an app that
// never opens is not.
const STARTUP_TIMEOUT_MS = 10_000;

export default function RootNavigator() {
  const { hydrated, resolvedScheme, theme } = useAppTheme();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const currentRouteName = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    isOnboardingComplete()
      .then((complete) => {
        if (!cancelled) setInitialRoute(complete ? 'Main' : 'Welcome');
      })
      .catch(() => {
        if (!cancelled) setInitialRoute('Welcome');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialRoute && hydrated) return;

    const timeout = setTimeout(() => setTimedOut(true), STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [initialRoute, hydrated]);

  const ready = (hydrated && initialRoute !== null) || timedOut;

  // Hand off from the native splash only once something is ready to render, so
  // startup never shows a blank frame between the two.
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = resolvedScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
        notification: theme.error,
      },
    };
  }, [resolvedScheme, theme]);

  // onStateChange never fires for the first render, so the initial screen is
  // tracked from onReady; afterwards only a change of route NAME counts, or a
  // params-only navigation double-counts the same screen.
  const trackCurrentRoute = useCallback(() => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (routeName && currentRouteName.current !== routeName) {
      currentRouteName.current = routeName;
      analytics.screen(routeName);
    }
    return routeName;
  }, [navigationRef]);

  const handleStateChange = useCallback(() => {
    replayPendingDeepLink(trackCurrentRoute());
  }, [trackCurrentRoute]);

  if (!ready) return <StartupScreen />;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}
      fallback={<StartupScreen />}
      onReady={trackCurrentRoute}
      onStateChange={handleStateChange}>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName={initialRoute ?? 'Welcome'}
        screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Main" component={RootTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
