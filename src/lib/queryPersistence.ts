import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistedClient, Persister } from '@tanstack/query-persist-client-core';

import { normalizeError } from './appError';
import { analytics, errorReporter } from '@/observability/observability';

type PersistableQuery = {
  meta?: Record<string, unknown>;
  state: { status: string };
};

type PersistableMutation = {
  meta?: Record<string, unknown>;
  state: { isPaused: boolean };
};

export const QUERY_CACHE_BUSTER = 'v3';
const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MUTATION_OUTBOX_BUSTER = 'v1';
export const MUTATION_OUTBOX_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const QUERY_CACHE_KEY = 'starter:query-cache:v2';
const MUTATION_OUTBOX_KEY = 'starter:mutation-outbox:v1';
const LEGACY_CACHE_KEY = 'starter:query-cache:v1';

export function shouldPersistQuery(query: PersistableQuery): boolean {
  return (
    query.state.status === 'success' &&
    query.meta?.persist === true &&
    query.meta.sensitive !== true
  );
}

export function shouldPersistMutation(mutation: PersistableMutation): boolean {
  return (
    mutation.state.isPaused && mutation.meta?.persist === true && mutation.meta.offline === true
  );
}

const cachedQueryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 1000,
  retry: ({ error }) => {
    reportPersistenceFailure(error, 'query-cache-persist');
    return undefined;
  },
});

let outboxWrite = Promise.resolve();

// TanStack persists queries and mutations as one client, with one global
// maxAge. That is appropriate for cached reads but unsafe for queued writes: a
// stale query cache must never make a mutation disappear. Split the payload at
// the storage boundary and restore each part under its own retention policy.
export const queryPersister: Persister = {
  async persistClient(client) {
    const queryClient: PersistedClient = {
      ...client,
      buster: QUERY_CACHE_BUSTER,
      clientState: { queries: client.clientState.queries, mutations: [] },
    };
    const outboxClient: PersistedClient = {
      ...client,
      buster: MUTATION_OUTBOX_BUSTER,
      clientState: { queries: [], mutations: client.clientState.mutations },
    };

    // Query writes stay throttled; outbox writes are serialized immediately so
    // rapid updates cannot land out of order and a one-second throttle window
    // cannot lose a newly queued operation when the process is killed.
    const queryWrite = cachedQueryPersister.persistClient(queryClient);
    const serializedOutbox = JSON.stringify(outboxClient);
    outboxWrite = outboxWrite
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(MUTATION_OUTBOX_KEY, serializedOutbox))
      .catch((error) => reportPersistenceFailure(error, 'mutation-outbox-persist'));
    await Promise.all([queryWrite, outboxWrite]);
  },

  async restoreClient() {
    await AsyncStorage.removeItem(LEGACY_CACHE_KEY).catch(() => undefined);
    const [queryClient, outboxClient] = await Promise.all([
      restorePart(QUERY_CACHE_KEY, QUERY_CACHE_BUSTER, 'query-cache-restore'),
      restorePart(MUTATION_OUTBOX_KEY, MUTATION_OUTBOX_BUSTER, 'mutation-outbox-restore'),
    ]);

    const now = Date.now();
    const queries =
      queryClient && now - queryClient.timestamp <= QUERY_CACHE_MAX_AGE_MS
        ? queryClient.clientState.queries
        : [];
    const storedMutations = outboxClient?.clientState.mutations ?? [];
    const mutations = storedMutations.filter((mutation) => {
      const submittedAt = mutation.state.submittedAt || outboxClient?.timestamp || 0;
      return now - submittedAt <= MUTATION_OUTBOX_MAX_AGE_MS;
    });
    const expiredCount = storedMutations.length - mutations.length;
    if (expiredCount > 0) {
      analytics.track('offline_mutations_expired', { count: expiredCount });
      errorReporter.captureMessage('Expired offline mutations were discarded.', {
        context: 'mutation-outbox-expired',
        extra: { count: expiredCount },
      });
    }

    if (!queries.length && !mutations.length) return undefined;
    return {
      // Expiration has already been applied independently above. A fresh
      // timestamp keeps the provider's single global maxAge from discarding
      // the still-valid half of the combined client.
      timestamp: now,
      buster: QUERY_CACHE_BUSTER,
      clientState: { queries, mutations },
    };
  },

  async removeClient() {
    await outboxWrite.catch(() => undefined);
    await Promise.all([
      cachedQueryPersister.removeClient(),
      AsyncStorage.multiRemove([MUTATION_OUTBOX_KEY, LEGACY_CACHE_KEY]),
    ]);
  },
};

async function restorePart(
  key: string,
  expectedBuster: string,
  context: string
): Promise<PersistedClient | undefined> {
  try {
    const serialized = await AsyncStorage.getItem(key);
    if (!serialized) return undefined;
    const client = JSON.parse(serialized) as PersistedClient;
    if (!client.timestamp || client.buster !== expectedBuster || !client.clientState) {
      await AsyncStorage.removeItem(key);
      return undefined;
    }
    return client;
  } catch (error) {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    reportPersistenceFailure(error, context);
    return undefined;
  }
}

function reportPersistenceFailure(error: unknown, context: string) {
  const properties = { kind: normalizeError(error).kind };
  if (context.endsWith('restore')) analytics.track('cache_restore_failed', properties);
  else analytics.track('cache_persist_failed', properties);
  errorReporter.captureException(error, { context });
}
