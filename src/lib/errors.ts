import { normalizeError } from './appError';

export function friendlyErrorMessage(error: unknown): string {
  return normalizeError(error).userMessage;
}
