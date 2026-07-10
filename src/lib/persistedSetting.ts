import AsyncStorage from '@react-native-async-storage/async-storage';

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

export function createPersistedSetting<T>(
  key: string,
  defaultValue: T,
  codec: PersistedSettingCodec<T>
): PersistedSetting<T> {
  let cached: { readonly value: T } | null = null;
  let pendingRead: Promise<T> | null = null;
  const listeners = new Set<(value: T) => void>();
  const getCached = () => cached;

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
        } catch {
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
      cached = { value };
      listeners.forEach((listener) => listener(value));
      try {
        await AsyncStorage.setItem(key, codec.encode(value));
      } catch {
        // Keep the in-memory preference usable when device storage is unavailable.
      }
    },
  };
}
