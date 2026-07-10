import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { isOnboardingComplete } from '@/lib/onboarding';
import { analytics } from '@/observability/observability';
import { useAppTheme } from '@/providers/ThemeProvider';
import WelcomeScreen from '@/screens/WelcomeScreen';

import RootTabs from './RootTabs';

export type RootStackParamList = {
  Welcome: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { hydrated, resolvedScheme, theme } = useAppTheme();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
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

  const trackCurrentRoute = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (routeName && currentRouteName.current !== routeName) {
      currentRouteName.current = routeName;
      analytics.screen(routeName);
    }
  };

  if (!hydrated || !initialRoute) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={trackCurrentRoute}
      onStateChange={trackCurrentRoute}>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Main" component={RootTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
