import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient } from '@tanstack/query-persist-client-core';

import {
  MUTATION_OUTBOX_MAX_AGE_MS,
  queryPersister,
  shouldPersistMutation,
  shouldPersistQuery,
} from '../queryPersistence';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('query persistence policy', () => {
  it('persists only successful, explicitly safe queries', () => {
    expect(shouldPersistQuery({ state: { status: 'success' }, meta: { persist: true } })).toBe(
      true
    );
    expect(shouldPersistQuery({ state: { status: 'success' } })).toBe(false);
    expect(
      shouldPersistQuery({
        state: { status: 'success' },
        meta: { persist: true, sensitive: true },
      })
    ).toBe(false);
    expect(shouldPersistQuery({ state: { status: 'error' }, meta: { persist: true } })).toBe(false);
  });

  it('persists only paused, explicitly registered offline mutations', () => {
    expect(
      shouldPersistMutation({
        state: { isPaused: true },
        meta: { persist: true, offline: true },
      })
    ).toBe(true);
    expect(
      shouldPersistMutation({
        state: { isPaused: false },
        meta: { persist: true, offline: true },
      })
    ).toBe(false);
    expect(shouldPersistMutation({ state: { isPaused: true }, meta: { persist: true } })).toBe(
      false
    );
  });
});

describe('split cache and mutation persistence', () => {
  it('keeps a queued mutation after the query-cache retention window', async () => {
    const timestamp = Date.now() - 25 * 60 * 60 * 1000;

    await queryPersister.persistClient(persistedClient(timestamp, timestamp));
    const restored = await queryPersister.restoreClient();

    expect(restored?.clientState.queries).toEqual([]);
    expect(restored?.clientState.mutations).toHaveLength(1);
  });

  it('expires outbox entries only after the dedicated retention window', async () => {
    const submittedAt = Date.now() - MUTATION_OUTBOX_MAX_AGE_MS - 1;
    await queryPersister.persistClient(persistedClient(Date.now(), submittedAt));

    const restored = await queryPersister.restoreClient();

    expect(restored?.clientState.queries).toHaveLength(1);
    expect(restored?.clientState.mutations).toEqual([]);
  });
});

function persistedClient(timestamp: number, submittedAt: number): PersistedClient {
  return {
    timestamp,
    buster: 'provider-buster',
    clientState: {
      queries: [
        {
          queryKey: ['cached'],
          queryHash: '["cached"]',
          state: {
            data: 'value',
            dataUpdateCount: 1,
            dataUpdatedAt: timestamp,
            error: null,
            errorUpdateCount: 0,
            errorUpdatedAt: 0,
            fetchFailureCount: 0,
            fetchFailureReason: null,
            fetchMeta: null,
            isInvalidated: false,
            status: 'success',
            fetchStatus: 'idle',
          },
        },
      ],
      mutations: [
        {
          mutationKey: ['items', 'create'],
          meta: { offline: true, persist: true },
          scope: { id: 'offline-outbox' },
          state: {
            context: undefined,
            data: undefined,
            error: null,
            failureCount: 0,
            failureReason: null,
            isPaused: true,
            status: 'pending',
            variables: { idempotencyKey: 'create-1' },
            submittedAt,
          },
        },
      ],
    },
  } as PersistedClient;
}
