import { useCallback, useEffect, useState } from 'react';

import type { PersistedSetting } from '@/lib/persistedSetting';

export function usePersistedSetting<T>(setting: PersistedSetting<T>) {
  const cached = setting.getCached();
  const [value, setValueState] = useState(cached ? cached.value : setting.defaultValue);
  const [hydrated, setHydrated] = useState(cached !== null);
  const [writeError, setWriteError] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;

    setting
      .read()
      .then((stored) => {
        if (!cancelled) {
          setValueState(stored);
          setHydrated(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });

    const unsubscribe = setting.subscribe((next) => {
      setValueState(next);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setting]);

  const setValue = useCallback(
    async (next: T) => {
      setValueState(next);
      setHydrated(true);
      setWriteError(null);
      try {
        await setting.set(next);
        return true;
      } catch (error) {
        const committed = setting.getCached();
        if (committed) setValueState(committed.value);
        setWriteError(error);
        return false;
      }
    },
    [setting]
  );

  return { value, hydrated, writeError, setValue };
}
