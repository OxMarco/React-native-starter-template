import { AppError } from '../appError';
import { withRetry } from '../withRetry';

const transient = () =>
  new AppError({
    kind: 'server',
    message: 'upstream unavailable',
    userMessage: 'Try again shortly.',
    retryable: true,
  });

const permanent = () =>
  new AppError({
    kind: 'validation',
    message: 'bad request',
    userMessage: 'Check the form.',
    retryable: false,
  });

// Backoff comes from the shared policy, so every test drives real timers
// through a deterministic random and a fake clock.
const options = { random: () => 0.5 };

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function run<T>(promise: Promise<T>) {
    // Let each backoff timer fire until the chain settles.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      jest.runOnlyPendingTimers();
    }
    return promise;
  }

  it('returns the first success without waiting', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    await expect(withRetry(operation, options)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure and resolves', async () => {
    const operation = jest.fn().mockRejectedValueOnce(transient()).mockResolvedValue('recovered');

    await expect(run(withRetry(operation, options))).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('fails immediately on a non-retryable error', async () => {
    const operation = jest.fn().mockRejectedValue(permanent());

    await expect(run(withRetry(operation, options))).rejects.toThrow('bad request');
    // A programming error must reach the reporter once, not three times.
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('rethrows the original error once attempts run out', async () => {
    const error = transient();
    const operation = jest.fn().mockRejectedValue(error);

    // The original instance, not a wrapper — downstream classification and
    // reporting depend on seeing what actually failed.
    await expect(run(withRetry(operation, { ...options, attempts: 2 }))).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('defaults to the query client retry budget', async () => {
    const operation = jest.fn().mockRejectedValue(transient());

    await expect(run(withRetry(operation, options))).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('passes the attempt number to the operation', async () => {
    const seen: number[] = [];
    const operation = jest.fn(async (attempt: number) => {
      seen.push(attempt);
      if (attempt < 3) throw transient();
      return 'ok';
    });

    await expect(run(withRetry(operation, options))).resolves.toBe('ok');
    expect(seen).toEqual([1, 2, 3]);
  });

  it('honours Retry-After instead of the exponential schedule', async () => {
    const operation = jest.fn().mockRejectedValue(
      new AppError({
        kind: 'rate-limit',
        message: 'slow down',
        userMessage: 'Too many requests.',
        retryable: true,
        retryAfterMs: 30_000,
      })
    );
    const promise = withRetry(operation, { ...options, attempts: 2 }).catch(() => 'failed');

    await Promise.resolve();
    await Promise.resolve();
    // Well past the exponential delay for attempt 1, but short of Retry-After.
    jest.advanceTimersByTime(5_000);
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(25_000);
    await run(promise);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('stops on abort and surfaces why the work failed', async () => {
    const controller = new AbortController();
    const error = transient();
    const operation = jest.fn().mockRejectedValue(error);
    const promise = withRetry(operation, { ...options, signal: controller.signal });

    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    // The abort is how it stopped, not what went wrong — callers need the
    // latter to classify and report.
    await expect(run(promise)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
