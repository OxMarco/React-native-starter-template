import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPersistedSetting } from '../persistedSetting';

describe('createPersistedSetting', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('decodes storage and notifies subscribers on writes', async () => {
    await AsyncStorage.setItem('test:setting', 'dark');
    const setting = createPersistedSetting('test:setting', 'auto', {
      decode: (raw) => raw ?? 'auto',
      encode: String,
    });
    const listener = jest.fn();
    setting.subscribe(listener);

    await expect(setting.read()).resolves.toBe('dark');
    await setting.set('light');

    expect(listener).toHaveBeenCalledWith('light');
    await expect(AsyncStorage.getItem('test:setting')).resolves.toBe('light');
  });

  it('falls back when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
    const setting = createPersistedSetting('test:fallback', 'auto', {
      decode: (raw) => raw ?? 'auto',
      encode: String,
    });

    await expect(setting.read()).resolves.toBe('auto');
  });

  it('caches nullable values without reading storage again', async () => {
    await AsyncStorage.setItem('test:nullable', 'null');
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    const setting = createPersistedSetting<string | null>('test:nullable', 'fallback', {
      decode: (raw) => (raw === 'null' ? null : raw),
      encode: (value) => value ?? 'null',
    });

    await expect(setting.read()).resolves.toBeNull();
    await expect(setting.read()).resolves.toBeNull();

    expect(setting.getCached()).toEqual({ value: null });
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent storage reads', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    const setting = createPersistedSetting('test:concurrent', 'auto', {
      decode: (raw) => raw ?? 'auto',
      encode: String,
    });

    const first = setting.read();
    const second = setting.read();

    await expect(Promise.all([first, second])).resolves.toEqual(['auto', 'auto']);
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('rejects failed writes without publishing an uncommitted value', async () => {
    const setting = createPersistedSetting('test:failed-write', 'granted', {
      decode: (raw) => raw ?? 'granted',
      encode: String,
    });
    await setting.read();
    const listener = jest.fn();
    setting.subscribe(listener);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(setting.set('denied')).rejects.toThrow('disk full');

    expect(setting.getCached()).toEqual({ value: 'granted' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps fail-closed values live when their durable write fails', async () => {
    const setting = createPersistedSetting(
      'test:consent',
      'granted',
      { decode: (raw) => raw ?? 'granted', encode: String },
      { optimisticWhen: (value) => value === 'denied' }
    );
    await setting.read();
    const listener = jest.fn();
    setting.subscribe(listener);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(setting.set('denied')).rejects.toThrow('disk full');

    expect(setting.getCached()).toEqual({ value: 'denied' });
    expect(listener).toHaveBeenCalledWith('denied');
  });
});
