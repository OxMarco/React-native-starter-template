import 'react-native-gesture-handler';
// Initialises Sentry and PostHog before any application module is evaluated, so
// a crash during module loading or the first render is still reported.
import '@/observability/setup';

import * as SplashScreen from 'expo-splash-screen';

import ErrorBoundary from '@/components/ErrorBoundary';
import { installExpoFetchCancelGuard } from '@/lib/expoFetchCancelGuard';
import RootNavigator from '@/navigation/RootNavigator';
import AppProviders from '@/providers/AppProviders';

import './global.css';

// Before the first request, so an aborted fetch cannot surface as an unhandled
// rejection. See the module for what Expo does and why it needs a handler.
installExpoFetchCancelGuard();

// Called before the first render so the native splash stays up while the theme
// preference and onboarding flag are read. RootNavigator hides it once there is
// something to show. A rejection here only means the splash was already gone.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  return (
    <ErrorBoundary context="App">
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </ErrorBoundary>
  );
}
