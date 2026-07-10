import { onlineManager, QueryClient } from '@tanstack/react-query';

import {
  assertOfflineMutationVariables,
  registerOfflineMutation,
  withIdempotencyKey,
} from '../offlineMutations';

describe('offline mutations', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('registers a resumable mutation function and safe persistence metadata', () => {
    const client = new QueryClient();
    const mutationFn = jest.fn(async (variables: { idempotencyKey: string; title: string }) => ({
      id: variables.idempotencyKey,
    }));

    registerOfflineMutation(client, {
      mutationKey: ['items', 'create'],
      operationName: 'create_item',
      mutationFn,
    });

    expect(client.getMutationDefaults(['items', 'create'])).toMatchObject({
      mutationFn,
      networkMode: 'online',
      retry: false,
      meta: { offline: true, persist: true, operationName: 'create_item' },
    });
  });

  it('adds an idempotency key to variables', () => {
    expect(withIdempotencyKey({ title: 'Example' }, 'create-item')).toMatchObject({
      title: 'Example',
      idempotencyKey: expect.stringMatching(/^create-item-/),
    });
  });

  it('rejects unsafe variables before they can be persisted', () => {
    expect(() => assertOfflineMutationVariables({ title: 'Missing key' })).toThrow(
      'idempotencyKey'
    );

    const circular: Record<string, unknown> = { idempotencyKey: 'operation-1' };
    circular.self = circular;
    expect(() => assertOfflineMutationVariables(circular)).toThrow('JSON-serializable');

    expect(() =>
      assertOfflineMutationVariables({ idempotencyKey: 'operation-2', lost: undefined })
    ).toThrow('JSON-serializable');
  });

  it('pauses while offline and resumes with the registered function', async () => {
    const client = new QueryClient();
    const mutationFn = jest.fn(async (variables: { idempotencyKey: string; title: string }) => ({
      id: variables.idempotencyKey,
    }));
    const mutationKey = ['items', 'offline-create'] as const;
    registerOfflineMutation(client, {
      mutationKey,
      operationName: 'offline_create_item',
      mutationFn,
    });

    onlineManager.setOnline(false);
    const mutation = client
      .getMutationCache()
      .build(client, client.defaultMutationOptions({ mutationKey }));
    const execution = mutation.execute({ idempotencyKey: 'create-1', title: 'Example' });
    await Promise.resolve();

    expect(mutation.state.isPaused).toBe(true);
    expect(mutationFn).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await client.resumePausedMutations();

    await expect(execution).resolves.toEqual({ id: 'create-1' });
    expect(mutationFn).toHaveBeenCalledTimes(1);
    mutation.destroy();
    client.clear();
  });
});
