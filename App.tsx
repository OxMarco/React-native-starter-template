import 'react-native-gesture-handler';

import ErrorBoundary from '@/components/ErrorBoundary';
import RootNavigator from '@/navigation/RootNavigator';
import AppProviders from '@/providers/AppProviders';

import './global.css';

export default function App() {
  return (
    <ErrorBoundary context="App">
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </ErrorBoundary>
  );
}
