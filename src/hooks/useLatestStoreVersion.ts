import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchLatestStoreVersion } from '@/lib/storeVersion';

// Releases are infrequent and the Android lookup downloads a full Play listing,
// so this must not repeat on every focus. Once stale, foregrounding the app is
// what triggers the next check.
const STORE_VERSION_STALE_MS = 6 * 60 * 60 * 1000;

export function useLatestStoreVersion(): UseQueryResult<string | null, Error> {
  return useQuery({
    queryKey: ['store-version'],
    queryFn: ({ signal }) => fetchLatestStoreVersion(signal),
    // Deliberately not persisted (no `meta.persist`): a version cached from a
    // previous launch could keep nagging after the user has already updated.
    meta: { operationName: 'store_version' },
    staleTime: STORE_VERSION_STALE_MS,
    gcTime: STORE_VERSION_STALE_MS,
    // The user never sees this fail, but a second retry makes a transient mobile
    // network failure much less likely to suppress the nudge for six hours.
    retry: 2,
    refetchOnWindowFocus: true,
  });
}
