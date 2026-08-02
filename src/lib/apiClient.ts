import { AppError, appErrorFromStatus, normalizeError, parseRetryAfter } from './appError';

export type JsonRequestOptions = RequestInit & {
  timeoutMs?: number;
};

export type JsonDecoder<T> = (value: unknown) => T;

type DecodedJsonRequestOptions<T> = JsonRequestOptions & {
  decode: JsonDecoder<T>;
  expectEmpty?: false;
};

type EmptyRequestOptions = JsonRequestOptions & {
  decode?: never;
  expectEmpty: true;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export function requestJson<T>(url: string, options: DecodedJsonRequestOptions<T>): Promise<T>;
export function requestJson(url: string, options: EmptyRequestOptions): Promise<void>;
export function requestJson(
  url: string,
  options?: JsonRequestOptions & { decode?: never; expectEmpty?: false }
): Promise<unknown>;
export async function requestJson(
  url: string,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    decode,
    expectEmpty = false,
    ...init
  }: JsonRequestOptions & {
    decode?: JsonDecoder<unknown>;
    expectEmpty?: boolean;
  } = {}
): Promise<unknown | void> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new AppError({
      kind: 'validation',
      code: 'invalid-timeout',
      message: 'timeoutMs must be a positive finite number',
      userMessage: 'The request could not be started.',
      retryable: false,
    });
  }

  const controller = new AbortController();
  let abortSource: 'caller' | 'timeout' | null = null;

  const abortFromCaller = () => {
    if (abortSource) return;
    abortSource = 'caller';
    controller.abort();
  };
  if (externalSignal?.aborted) abortFromCaller();
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    if (abortSource) return;
    abortSource = 'timeout';
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

    if (response.status === 204 || response.status === 205) {
      if (expectEmpty) return undefined;
      throw invalidResponse('unexpected-empty-response', 'The server returned an empty response.', {
        requestId,
      });
    }

    if (expectEmpty) return undefined;

    try {
      const body: unknown = await response.json();
      if (!decode) return body;
      try {
        return decode(body);
      } catch (error) {
        throw invalidResponse(
          'response-validation-failed',
          'The response did not match its schema.',
          {
            requestId,
            cause: error,
          }
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
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
    if (abortSource === 'timeout') {
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

function invalidResponse(
  code: string,
  message: string,
  context: { requestId?: string; cause?: unknown }
) {
  return new AppError({
    kind: 'server',
    code,
    message,
    userMessage: 'The service returned an invalid response. Try again shortly.',
    retryable: false,
    ...context,
  });
}
