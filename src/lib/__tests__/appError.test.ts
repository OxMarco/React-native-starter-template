import {
  AppError,
  appErrorFromStatus,
  normalizeError,
  parseRetryAfter,
  shouldReportError,
} from '../appError';

describe('AppError', () => {
  it.each([
    [401, 'auth', false],
    [403, 'forbidden', false],
    [404, 'not-found', false],
    [408, 'timeout', true],
    [422, 'validation', false],
    [429, 'rate-limit', true],
    [503, 'server', true],
  ] as const)('classifies status %s as %s', (status, kind, retryable) => {
    const error = appErrorFromStatus(status);
    expect(error).toMatchObject({ kind, retryable, status });
  });

  it('normalizes common runtime errors without exposing their message to users', () => {
    const network = normalizeError(new Error('Network request failed for /private/account/42'));
    const unexpected = normalizeError(new Error('secret implementation detail'));

    expect(network).toMatchObject({ kind: 'network', retryable: true });
    expect(network.userMessage).not.toContain('/private/account/42');
    expect(unexpected).toMatchObject({ kind: 'unknown', retryable: false });
    expect(unexpected.userMessage).not.toContain('secret implementation detail');
  });

  it('preserves an existing AppError', () => {
    const original = appErrorFromStatus(429, { retryAfterMs: 5000 });
    expect(normalizeError(original)).toBe(original);
  });

  it('parses Retry-After seconds and dates', () => {
    expect(parseRetryAfter('3', 0)).toBe(3000);
    expect(parseRetryAfter('Thu, 01 Jan 1970 00:00:05 GMT', 1000)).toBe(4000);
    expect(parseRetryAfter('invalid', 0)).toBeUndefined();
  });

  it('reports unexpected and server errors, not expected operational failures', () => {
    expect(shouldReportError(appErrorFromStatus(503))).toBe(true);
    expect(
      shouldReportError(
        new AppError({
          kind: 'unknown',
          message: 'bug',
          userMessage: 'Something went wrong.',
          retryable: false,
        })
      )
    ).toBe(true);
    expect(shouldReportError(appErrorFromStatus(422))).toBe(false);
  });
});
