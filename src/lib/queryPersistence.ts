type PersistableQuery = {
  meta?: Record<string, unknown>;
  state: { status: string };
};

type PersistableMutation = {
  meta?: Record<string, unknown>;
  state: { isPaused: boolean };
};

export const QUERY_CACHE_BUSTER = 'v2';
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function shouldPersistQuery(query: PersistableQuery): boolean {
  return (
    query.state.status === 'success' &&
    query.meta?.persist === true &&
    query.meta.sensitive !== true
  );
}

export function shouldPersistMutation(mutation: PersistableMutation): boolean {
  return (
    mutation.state.isPaused && mutation.meta?.persist === true && mutation.meta.offline === true
  );
}
