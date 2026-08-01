import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient, QueryLifecycle, queryPersister } from '@/lib/queryClient';
import { resumeOfflineMutations } from '@/lib/offlineMutations';
import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE_MS,
  shouldPersistMutation,
  shouldPersistQuery,
} from '@/lib/queryPersistence';
import { normalizeError } from '@/lib/appError';
import { analytics, errorReporter } from '@/observability/observability';

import ObservabilityProvider from './ObservabilityProvider';
import ThemeProvider from './ThemeProvider';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            buster: QUERY_CACHE_BUSTER,
            maxAge: QUERY_CACHE_MAX_AGE_MS,
            dehydrateOptions: {
              shouldDehydrateQuery: shouldPersistQuery,
              shouldDehydrateMutation: shouldPersistMutation,
            },
          }}
          onSuccess={handleCacheRestoreSuccess}
          onError={handleCacheRestoreError}>
          <QueryLifecycle />
          <ObservabilityProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </ObservabilityProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Resuming replays real network writes, so it can reject. Returning the bare
// promise left that rejection unhandled — which, now that unhandled rejections
// are reported, would surface as an uncontextualised crash report.
function handleCacheRestoreSuccess() {
  void resumeOfflineMutations(queryClient).catch((error) => {
    errorReporter.captureException(error, { context: 'offline-mutation-resume' });
  });
}

function handleCacheRestoreError() {
  const error = new Error('The persisted query cache could not be restored.');
  const normalized = normalizeError(error);
  analytics.track('cache_restore_failed', { kind: normalized.kind });
  errorReporter.captureException(error, { context: 'query-cache-restore' });
}
