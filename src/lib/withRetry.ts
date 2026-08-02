import { normalizeError } from './appError';
import { MAX_QUERY_RETRIES, retryDelay } from './retryPolicy';

// Retry for work that does not go through TanStack Query — a one-off call from
// an event handler, a startup task, a background job.
//
// It deliberately reuses `retryPolicy.ts` rather than defining a second policy.
// Two retry policies in one codebase drift, and the day they disagree is the
// day a `Retry-After: 120` is honoured on one path and hammered on the other.
// So this shares the same `retryable` classification and the same jittered,
// `Retry-After`-aware backoff the query client uses.
//
// Not a general-purpose wrapper for everything: if a call can be expressed as a
// query, use a query and get caching, dedup, and persistence with it.

export type RetryOptions = {
  /** Total attempts including the first. Defaults to the query client's budget. */
  attempts?: number;
  /**
   * Retry only while this returns true. Defaults to the shared classification,
   * so a programming error (a TypeError, a schema mismatch) fails on the first
   * attempt and reaches the error reporter once rather than three times.
   */
  shouldRetry?: (error: unknown) => boolean;
  /** Aborting rejects the pending backoff immediately with the last error. */
  signal?: AbortSignal;
  /** Seam for tests; defaults to `Math.random` via the shared backoff. */
  random?: () => number;
};

const DEFAULT_ATTEMPTS = MAX_QUERY_RETRIES + 1;

function isRetryable(error: unknown): boolean {
  return normalizeError(error).retryable;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Retry aborted'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Runs `operation`, retrying transient failures with the shared backoff.
 *
 * Rethrows the ORIGINAL error unchanged when attempts run out or the predicate
 * declines, so downstream classification and reporting still see what actually
 * failed rather than a wrapper. There is no per-attempt timeout — `requestJson`
 * carries its own, and adding a second one here would silently shorten it.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const shouldRetry = options.shouldRetry ?? isRetryable;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      try {
        await wait(retryDelay(attempt - 2, lastError, options.random), options.signal);
      } catch {
        // Aborted mid-backoff. Surface why the work failed, not the abort.
        throw lastError;
      }
    }

    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || options.signal?.aborted) throw error;
    }
  }

  throw lastError;
}
