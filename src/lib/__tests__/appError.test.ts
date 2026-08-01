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

  it('classifies transport failures ahead of numbers that appear in their message', () => {
    // Regression: a bare three-digit scan read the retry count as HTTP 300 and
    // returned a non-retryable `unknown`, silently disabling retries for DNS
    // failures. The same scan turned timeouts into `server` errors.
    expect(
      normalizeError(new Error('Unable to resolve host api.example.com after 300 attempts'))
    ).toMatchObject({ kind: 'network', retryable: true });
    expect(normalizeError(new Error('Request timed out after 500 ms'))).toMatchObject({
      kind: 'timeout',
      retryable: true,
    });
    expect(
      normalizeError(new Error('Network request failed contacting 10.0.2.2:8081'))
    ).toMatchObject({ kind: 'network', retryable: true });
  });

  it('ignores incidental numbers but still reads a stated status', () => {
    expect(normalizeError(new Error('Failed to fetch item 404 from list'))).toMatchObject({
      kind: 'unknown',
      retryable: false,
    });
    expect(normalizeError(new Error('Request failed with status 503'))).toMatchObject({
      kind: 'server',
      retryable: true,
    });
    expect(normalizeError(new Error('Request failed (404): /items'))).toMatchObject({
      kind: 'not-found',
    });
  });

  it('reads a structured status but rejects values outside the HTTP range', () => {
    expect(normalizeError({ status: 429 })).toMatchObject({ kind: 'rate-limit' });
    expect(normalizeError({ response: { status: 500 } })).toMatchObject({ kind: 'server' });
    expect(normalizeError(Object.assign(new Error('boom'), { status: 99 }))).toMatchObject({
      kind: 'unknown',
    });
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
