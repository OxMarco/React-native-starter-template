import AsyncStorage from '@react-native-async-storage/async-storage';

import { errorReporter } from '@/observability/observability';

export type PersistedSetting<T> = {
  defaultValue: T;
  getCached: () => { readonly value: T } | null;
  subscribe: (listener: (value: T) => void) => () => void;
  read: () => Promise<T>;
  set: (value: T) => Promise<void>;
};

export type PersistedSettingCodec<T> = {
  decode: (raw: string | null) => T;
  encode: (value: T) => string;
};

export type PersistedSettingOptions<T> = {
  // Consent withdrawal must affect every live subscriber immediately even if
  // durable storage is unavailable. Other values publish only after the write
  // succeeds, so observers never mistake an uncommitted value for saved state.
  optimisticWhen?: (value: T) => boolean;
};

export function createPersistedSetting<T>(
  key: string,
  defaultValue: T,
  codec: PersistedSettingCodec<T>,
  options: PersistedSettingOptions<T> = {}
): PersistedSetting<T> {
  let cached: { readonly value: T } | null = null;
  let pendingRead: Promise<T> | null = null;
  const listeners = new Set<(value: T) => void>();
  const getCached = () => cached;
  let writeQueue = Promise.resolve();
  const publish = (value: T) => {
    cached = { value };
    listeners.forEach((listener) => listener(value));
  };

  return {
    defaultValue,
    getCached,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async read() {
      const current = getCached();
      if (current) return current.value;
      if (pendingRead) return pendingRead;

      pendingRead = (async () => {
        let stored: T;
        try {
          stored = codec.decode(await AsyncStorage.getItem(key));
        } catch (error) {
          errorReporter.captureException(error, {
            context: 'persisted-setting-read',
            tags: { setting: key },
          });
          stored = defaultValue;
        }

        // A newer write may finish while the storage read is still in flight.
        const latest = getCached();
        if (latest) return latest.value;
        cached = { value: stored };
        return stored;
      })().finally(() => {
        pendingRead = null;
      });

      return pendingRead;
    },
    async set(value) {
      const optimistic = options.optimisticWhen?.(value) === true;
      if (optimistic) publish(value);

      const write = writeQueue
        .catch(() => undefined)
        .then(() => AsyncStorage.setItem(key, codec.encode(value)));
      writeQueue = write;
      try {
        await write;
        if (!optimistic) publish(value);
      } catch (error) {
        // Keep the in-memory preference usable when device storage is
        // unavailable, but do not stay quiet about it: the setting looks
        // applied and then silently reverts on the next launch, which is
        // otherwise near-impossible to diagnose from a bug report. The key is
        // safe to report; the value may be user data, so it is not included.
        errorReporter.captureException(error, {
          context: 'persisted-setting-write',
          tags: { setting: key },
        });
        throw error;
      }
    },
  };
}
