import type { MutationFunction, MutationKey, QueryClient } from '@tanstack/react-query';

import { AppError } from './appError';
import { retryDelay } from './retryPolicy';
import { analytics } from '@/observability/observability';

export type IdempotentMutationVariables = {
  idempotencyKey: string;
};

export type OfflineMutationDefinition<TData, TVariables extends IdempotentMutationVariables> = {
  mutationKey: MutationKey;
  operationName: string;
  mutationFn: MutationFunction<TData, TVariables>;
  retry?: number;
};

export function registerOfflineMutation<TData, TVariables extends IdempotentMutationVariables>(
  queryClient: QueryClient,
  definition: OfflineMutationDefinition<TData, TVariables>
) {
  if (!definition.mutationKey.length) {
    throw new Error('Offline mutations require a non-empty mutation key.');
  }
  if (!/^[a-z0-9_.-]+$/i.test(definition.operationName)) {
    throw new Error('Offline mutation operation names may contain only letters, numbers, ._-');
  }

  queryClient.setMutationDefaults(definition.mutationKey, {
    mutationFn: definition.mutationFn as MutationFunction<unknown, unknown>,
    networkMode: 'online',
    retry: definition.retry ?? false,
    retryDelay,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    meta: {
      offline: true,
      persist: true,
      operationName: definition.operationName,
    },
  });
}

export function withIdempotencyKey<TVariables extends Record<string, unknown>>(
  variables: TVariables,
  prefix = 'mutation'
): TVariables & IdempotentMutationVariables {
  return { ...variables, idempotencyKey: createIdempotencyKey(prefix) };
}

export function createIdempotencyKey(prefix = 'mutation'): string {
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'mutation';
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const unique =
    cryptoApi?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${safePrefix}-${unique}`;
}

export function assertOfflineMutationVariables(variables: unknown): asserts variables is {
  idempotencyKey: string;
} {
  if (typeof variables !== 'object' || variables === null) {
    throw invalidOfflineMutation('Offline mutation variables must be an object.');
  }

  const idempotencyKey = Reflect.get(variables, 'idempotencyKey');
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw invalidOfflineMutation('Offline mutations require a non-empty idempotencyKey.');
  }

  try {
    assertJsonSerializable(variables);
  } catch (error) {
    throw invalidOfflineMutation('Offline mutation variables must be JSON-serializable.', error);
  }
}

export async function resumeOfflineMutations(queryClient: QueryClient): Promise<void> {
  const pausedCount = queryClient
    .getMutationCache()
    .getAll()
    .filter((mutation) => mutation.state.isPaused && mutation.meta?.offline === true).length;

  if (pausedCount === 0) return;
  await queryClient.resumePausedMutations();
  analytics.track('offline_mutations_resumed', { count: pausedCount });
}

function invalidOfflineMutation(message: string, cause?: unknown): AppError {
  return new AppError({
    kind: 'validation',
    code: 'invalid-offline-mutation',
    message,
    userMessage: 'This change could not be queued safely. Please try again.',
    retryable: false,
    cause,
  });
}

function assertJsonSerializable(
  value: unknown,
  path = 'variables',
  ancestors = new Set<object>()
): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new Error(`${path} must contain only finite numbers.`);
  }
  if (typeof value !== 'object') {
    throw new Error(`${path} contains an unsupported ${typeof value} value.`);
  }
  if (ancestors.has(value)) throw new Error(`${path} contains a circular reference.`);

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} contains a non-plain object.`);
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSerializable(item, `${path}[${index}]`, ancestors));
  } else {
    Object.entries(value).forEach(([key, item]) =>
      assertJsonSerializable(item, `${path}.${key}`, ancestors)
    );
  }
  ancestors.delete(value);
}
