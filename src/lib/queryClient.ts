import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { normalizeError, shouldReportError } from './appError';
import { assertOfflineMutationVariables } from './offlineMutations';
import { retryDelay, shouldRetryQuery } from './retryPolicy';
import { analytics, errorReporter } from '@/observability/observability';

const queryRetryCounts = new Map<string, number>();
const queryCache = new QueryCache({
  onError: (error, query) => {
    reportCacheFailure('query', query.meta?.operationName, error);
  },
});

queryCache.subscribe((event) => {
  if (event.type === 'removed') {
    queryRetryCounts.delete(event.query.queryHash);
    return;
  }
  if (event.type !== 'updated') return;

  if (event.action.type === 'failed') {
    queryRetryCounts.set(event.query.queryHash, event.action.failureCount);
    return;
  }

  const attempts = queryRetryCounts.get(event.query.queryHash);
  if (event.action.type === 'success' && attempts) {
    const operation = event.query.meta?.operationName ?? 'unlabeled_query';
    analytics.track('query_retry_succeeded', { operation, attempts });
    errorReporter.addBreadcrumb('query_retry_succeeded', { operation, attempts });
  }
  if (event.action.type === 'success' || event.action.type === 'error') {
    queryRetryCounts.delete(event.query.queryHash);
  }
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache: new MutationCache({
    onMutate: (variables, mutation) => {
      if (mutation.meta?.offline === true) assertOfflineMutationVariables(variables);
    },
    onError: (error, _variables, _onMutateResult, mutation) => {
      reportCacheFailure('mutation', mutation.meta?.operationName, error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: shouldRetryQuery,
      retryDelay,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: {
      networkMode: 'online',
      retry: false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'starter:query-cache:v1',
  throttleTime: 1000,
  retry: ({ error }) => {
    const normalized = normalizeError(error);
    analytics.track('cache_persist_failed', { kind: normalized.kind });
    errorReporter.captureException(error, { context: 'query-cache-persist' });
    return undefined;
  },
});

export async function clearPersistedServerState(): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  })
);

export function QueryLifecycle() {
  useEffect(() => {
    const onAppStateChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return null;
}

function reportCacheFailure(
  type: 'query' | 'mutation',
  operationName: string | undefined,
  error: unknown
) {
  const normalized = normalizeError(error);
  if (normalized.kind === 'cancelled') return;

  const properties = {
    operation: operationName ?? `unlabeled_${type}`,
    kind: normalized.kind,
    retryable: normalized.retryable,
  };

  if (type === 'query') analytics.track('query_failed', properties);
  else analytics.track('mutation_failed', properties);

  errorReporter.addBreadcrumb(`${type}_failed`, properties);
  if (shouldReportError(normalized)) {
    errorReporter.captureException(error, {
      context: `${type}-cache`,
      tags: { kind: normalized.kind, operation: properties.operation },
      extra: { retryable: normalized.retryable },
    });
  }
}
