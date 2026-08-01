import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act } from 'react-test-renderer';

import { createPersistedSetting, type PersistedSetting } from '@/lib/persistedSetting';

import { usePersistedSetting } from '../usePersistedSetting';

const codec = {
  decode: (raw: string | null) => raw ?? 'default',
  encode: (value: string) => value,
};

type Handle = ReturnType<typeof usePersistedSetting<string>>;

// Renders the hook and exposes its latest value, so tests can drive it without
// a screen. Mirrors the harness pattern used elsewhere in the suite.
async function renderSetting(setting: PersistedSetting<string>) {
  const handle: { current: Handle | null } = { current: null };

  function Harness() {
    handle.current = usePersistedSetting(setting);
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Harness />);
  });

  return { handle, renderer };
}

// jest.setup.js installs the official in-memory AsyncStorage mock.
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('usePersistedSetting', () => {
  it('starts on the default and reports hydration once storage has been read', async () => {
    await AsyncStorage.setItem('k', 'stored');
    const setting = createPersistedSetting('k', 'default', codec);

    const { handle } = await renderSetting(setting);

    expect(handle.current?.value).toBe('stored');
    expect(handle.current?.hydrated).toBe(true);
  });

  it('falls back to the default when the read fails', async () => {
    const failing = createPersistedSetting<string>('missing', 'default', {
      decode: () => {
        throw new Error('corrupt');
      },
      encode: (value) => value,
    });

    const { handle } = await renderSetting(failing);

    expect(handle.current?.value).toBe('default');
    expect(handle.current?.hydrated).toBe(true);
  });

  it('shares writes with every other subscriber of the same setting', async () => {
    const setting = createPersistedSetting('k', 'default', codec);
    const first = await renderSetting(setting);
    const second = await renderSetting(setting);

    await act(async () => {
      await first.handle.current?.setValue('next');
    });

    expect(first.handle.current?.value).toBe('next');
    expect(second.handle.current?.value).toBe('next');
    expect(await AsyncStorage.getItem('k')).toBe('next');
  });

  it('stops updating after unmount', async () => {
    const setting = createPersistedSetting('k', 'default', codec);
    const { handle, renderer } = await renderSetting(setting);
    const seen = handle.current?.value;

    act(() => renderer.unmount());
    await act(async () => {
      await setting.set('after-unmount');
    });

    expect(handle.current?.value).toBe(seen);
  });
});
