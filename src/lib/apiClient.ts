import { AppError, appErrorFromStatus, normalizeError, parseRetryAfter } from './appError';

export type JsonRequestOptions = RequestInit & {
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export async function requestJson<T>(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...init }: JsonRequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => controller.abort();
  if (externalSignal?.aborted) abortFromCaller();
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const requestId = response.headers.get('x-request-id') ?? undefined;

    if (!response.ok) {
      throw appErrorFromStatus(response.status, {
        requestId,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      });
    }

    if (response.status === 204) return undefined as T;

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new AppError({
        kind: 'server',
        code: 'invalid-json',
        message: 'The server returned invalid JSON',
        userMessage: 'The service returned an invalid response. Try again shortly.',
        retryable: true,
        requestId,
        cause: error,
      });
    }
  } catch (error) {
    if (timedOut) {
      throw new AppError({
        kind: 'timeout',
        code: 'request-timeout',
        message: `Request timed out after ${timeoutMs}ms`,
        userMessage: 'The request timed out. Check your connection and try again.',
        retryable: true,
        cause: error,
      });
    }
    throw normalizeError(error);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}
