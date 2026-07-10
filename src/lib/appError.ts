export type AppErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'forbidden'
  | 'not-found'
  | 'validation'
  | 'rate-limit'
  | 'server'
  | 'cancelled'
  | 'unknown';

export type AppErrorOptions = {
  kind: AppErrorKind;
  message: string;
  userMessage: string;
  retryable: boolean;
  status?: number;
  code?: string;
  requestId?: string;
  retryAfterMs?: number;
  cause?: unknown;
};

const USER_MESSAGES: Record<AppErrorKind, string> = {
  network: 'You appear to be offline. Check your connection and try again.',
  timeout: 'The request timed out. Check your connection and try again.',
  auth: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to do that.',
  'not-found': 'The requested item could not be found.',
  validation: 'Some of the information provided is invalid. Please review it and try again.',
  'rate-limit': 'Too many requests. Please wait a moment before trying again.',
  server: 'The service is temporarily unavailable. Try again shortly.',
  cancelled: 'The request was cancelled.',
  unknown: 'Something went wrong. Please try again.',
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
  readonly originalCause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.kind = options.kind;
    this.userMessage = options.userMessage;
    this.retryable = options.retryable;
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryAfterMs = options.retryAfterMs;
    this.originalCause = options.cause;
  }
}

export function appErrorFromStatus(
  status: number,
  context: {
    code?: string;
    requestId?: string;
    retryAfterMs?: number;
    cause?: unknown;
  } = {}
): AppError {
  const kind = kindForStatus(status);
  return new AppError({
    kind,
    message: `Request failed with status ${status}`,
    userMessage: USER_MESSAGES[kind],
    retryable: kind === 'timeout' || kind === 'rate-limit' || kind === 'server',
    status,
    ...context,
  });
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const message = messageOf(error);
  const status = statusOf(error, message);
  if (status !== null) return appErrorFromStatus(status, { cause: error });

  if (isAbortError(error)) {
    return createError('cancelled', message || 'Request cancelled', false, error);
  }
  if (/timed?\s*out|timeout/i.test(message)) {
    return createError('timeout', message || 'Request timed out', true, error);
  }
  if (/network request failed|fetch failed|unable to resolve host|network error/i.test(message)) {
    return createError('network', message || 'Network request failed', true, error);
  }

  return createError('unknown', message || 'Unexpected error', false, error);
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, date - now);
}

export function shouldReportError(error: unknown): boolean {
  const kind = normalizeError(error).kind;
  return kind === 'server' || kind === 'unknown';
}

function createError(
  kind: AppErrorKind,
  message: string,
  retryable: boolean,
  cause: unknown
): AppError {
  return new AppError({
    kind,
    message,
    userMessage: USER_MESSAGES[kind],
    retryable,
    cause,
  });
}

function kindForStatus(status: number): AppErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'validation';
  return 'unknown';
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '';
}

function statusOf(error: unknown, message: string): number | null {
  if (typeof error === 'object' && error !== null) {
    const direct = Reflect.get(error, 'status');
    if (typeof direct === 'number') return direct;

    const response = Reflect.get(error, 'response');
    if (typeof response === 'object' && response !== null) {
      const nested = Reflect.get(response, 'status');
      if (typeof nested === 'number') return nested;
    }
  }

  const match = message.match(/(?:^|\D)([1-5]\d{2})(?:\D|$)/);
  return match ? Number(match[1]) : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
