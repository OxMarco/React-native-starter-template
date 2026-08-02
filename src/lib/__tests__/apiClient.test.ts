import { requestJson } from '../apiClient';

describe('requestJson', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns decoded JSON', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ id: 1 }),
    } as unknown as Response);

    await expect(
      requestJson('https://example.test/item', {
        decode: (value) => value as { id: number },
      })
    ).resolves.toEqual({ id: 1 });
  });

  it('returns a typed rate-limit error with retry metadata', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name === 'retry-after' ? '4' : 'request-123'),
      },
    } as unknown as Response);

    await expect(requestJson('https://example.test/item')).rejects.toMatchObject({
      kind: 'rate-limit',
      requestId: 'request-123',
      retryAfterMs: 4000,
      retryable: true,
    });
  });

  it('classifies caller cancellation separately from timeouts', async () => {
    const controller = new AbortController();
    controller.abort();
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

    await expect(
      requestJson('https://example.test/item', { signal: controller.signal })
    ).rejects.toMatchObject({ kind: 'cancelled', retryable: false });
  });

  it('aborts and classifies requests that exceed their timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementationOnce((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      });
    });

    const request = requestJson('https://example.test/slow', { timeoutMs: 100 });
    jest.advanceTimersByTime(100);

    await expect(request).rejects.toMatchObject({
      kind: 'timeout',
      code: 'request-timeout',
      retryable: true,
    });
  });

  it('requires empty responses to be declared explicitly', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
    } as unknown as Response);

    await expect(requestJson('https://example.test/item')).rejects.toMatchObject({
      code: 'unexpected-empty-response',
    });
    await expect(
      requestJson('https://example.test/item', { expectEmpty: true })
    ).resolves.toBeUndefined();
  });

  it('turns decoder failures into a typed invalid-response error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'request-1' },
      json: async () => ({ id: 'wrong' }),
    } as unknown as Response);

    await expect(
      requestJson('https://example.test/item', {
        decode: () => {
          throw new Error('Expected a numeric id');
        },
      })
    ).rejects.toMatchObject({
      kind: 'server',
      code: 'response-validation-failed',
      requestId: 'request-1',
      retryable: false,
    });
  });

  it('rejects invalid timeout configuration before fetching', async () => {
    const fetch = jest.spyOn(global, 'fetch');

    await expect(requestJson('https://example.test/item', { timeoutMs: 0 })).rejects.toMatchObject({
      kind: 'validation',
      code: 'invalid-timeout',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
