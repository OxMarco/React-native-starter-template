import { normalizeError } from './appError';

export const MAX_QUERY_RETRIES = 2;
export const MAX_RETRY_DELAY_MS = 60_000;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && normalizeError(error).retryable;
}

export function retryDelay(
  attemptIndex: number,
  error: unknown,
  random: () => number = Math.random
): number {
  const retryAfterMs = normalizeError(error).retryAfterMs;
  if (retryAfterMs !== undefined) {
    return Math.max(0, Math.min(retryAfterMs, MAX_RETRY_DELAY_MS));
  }

  const exponentialDelay = Math.min(1000 * 2 ** attemptIndex, MAX_RETRY_DELAY_MS);
  const jitter = 0.8 + random() * 0.4;
  return Math.min(Math.round(exponentialDelay * jitter), MAX_RETRY_DELAY_MS);
}
