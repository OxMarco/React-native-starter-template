import { appErrorFromStatus, normalizeError } from '../appError';
import {
  MAX_QUERY_RETRIES,
  MAX_RETRY_DELAY_MS,
  retryDelay,
  shouldRetryQuery,
} from '../retryPolicy';

describe('query retry policy', () => {
  it('retries only transient errors within the configured limit', () => {
    expect(shouldRetryQuery(0, normalizeError(new Error('Network request failed')))).toBe(true);
    expect(shouldRetryQuery(0, appErrorFromStatus(503))).toBe(true);
    expect(shouldRetryQuery(0, appErrorFromStatus(401))).toBe(false);
    expect(shouldRetryQuery(0, appErrorFromStatus(422))).toBe(false);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, appErrorFromStatus(503))).toBe(false);
  });

  it('uses exponential backoff with bounded jitter', () => {
    expect(retryDelay(0, appErrorFromStatus(503), () => 0.5)).toBe(1000);
    expect(retryDelay(2, appErrorFromStatus(503), () => 0)).toBe(3200);
  });

  it('honors Retry-After within the maximum delay', () => {
    expect(retryDelay(0, appErrorFromStatus(429, { retryAfterMs: 12_000 }))).toBe(12_000);
    expect(retryDelay(0, appErrorFromStatus(429, { retryAfterMs: 120_000 }))).toBe(
      MAX_RETRY_DELAY_MS
    );
  });
});
