import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import ObservabilityProvider from '../ObservabilityProvider';

const mockInstallGlobalErrorHandlers = jest.fn(() => jest.fn());
const mockSetConsent = jest.fn();
const mockTrack = jest.fn();
const mockConsent = { value: 'undecided', hydrated: false };

jest.mock('@/hooks/usePersistedSetting', () => ({
  usePersistedSetting: () => mockConsent,
}));

jest.mock('@/observability/globalHandlers', () => ({
  installGlobalErrorHandlers: () => mockInstallGlobalErrorHandlers(),
}));

jest.mock('@/observability/observability', () => ({
  analytics: {
    setConsent: (...args: unknown[]) => mockSetConsent(...args),
    track: (...args: unknown[]) => mockTrack(...args),
  },
}));

describe('ObservabilityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsent.value = 'undecided';
    mockConsent.hydrated = false;
  });

  it('waits for hydration, then applies consent and tracks one cold launch', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ObservabilityProvider>
          <Text>child</Text>
        </ObservabilityProvider>
      );
    });

    expect(mockSetConsent).not.toHaveBeenCalled();
    mockConsent.value = 'granted';
    mockConsent.hydrated = true;
    act(() => {
      renderer.update(
        <ObservabilityProvider>
          <Text>child</Text>
        </ObservabilityProvider>
      );
    });
    act(() => {
      renderer.update(
        <ObservabilityProvider>
          <Text>child again</Text>
        </ObservabilityProvider>
      );
    });

    expect(mockInstallGlobalErrorHandlers).toHaveBeenCalledTimes(1);
    expect(mockSetConsent).toHaveBeenCalledWith('granted');
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('app_launched', { launch: 'cold' });
  });
});
