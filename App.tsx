import 'react-native-gesture-handler';

import * as SplashScreen from 'expo-splash-screen';

import ErrorBoundary from '@/components/ErrorBoundary';
import RootNavigator from '@/navigation/RootNavigator';
import AppProviders from '@/providers/AppProviders';

import './global.css';

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
