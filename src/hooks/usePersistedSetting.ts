import { useCallback, useEffect, useState } from 'react';

import type { PersistedSetting } from '@/lib/persistedSetting';

export function usePersistedSetting<T>(setting: PersistedSetting<T>) {
  const cached = setting.getCached();
  const [value, setValueState] = useState(cached ? cached.value : setting.defaultValue);
  const [hydrated, setHydrated] = useState(cached !== null);

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
      await setting.set(next);
    },
    [setting]
  );

  return { value, hydrated, setValue };
}
