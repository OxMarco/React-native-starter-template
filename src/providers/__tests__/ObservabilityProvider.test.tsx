import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import ObservabilityProvider from '../ObservabilityProvider';

const mockInstallGlobalErrorHandlers = jest.fn(() => jest.fn());
const mockSetConsent = jest.fn();
const mockTrack = jest.fn();
const mockBumpSessionCount = jest.fn(async () => undefined);
const mockStartLifecycleTracking = jest.fn(async () => undefined);
const mockStopLifecycleTracking = jest.fn();
const mockConsent = { value: 'denied', hydrated: false };

jest.mock('@/hooks/usePersistedSetting', () => ({
  usePersistedSetting: () => mockConsent,
}));

jest.mock('@/observability/globalHandlers', () => ({
  installGlobalErrorHandlers: () => mockInstallGlobalErrorHandlers(),
}));

jest.mock('@/lib/storeReview', () => ({
  bumpSessionCount: () => mockBumpSessionCount(),
}));

jest.mock('@/observability/lifecycle', () => ({
  startLifecycleTracking: () => mockStartLifecycleTracking(),
  stopLifecycleTracking: () => mockStopLifecycleTracking(),
}));

jest.mock('@/observability/observability', () => ({
  analytics: {
    setConsent: (...args: unknown[]) => mockSetConsent(...args),
    track: (...args: unknown[]) => mockTrack(...args),
  },
}));

function renderProvider(label = 'child') {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ObservabilityProvider>
        <Text>{label}</Text>
      </ObservabilityProvider>
    );
  });
  return renderer;
}

function update(renderer: TestRenderer.ReactTestRenderer, label: string) {
  act(() => {
    renderer.update(
      <ObservabilityProvider>
        <Text>{label}</Text>
      </ObservabilityProvider>
    );
  });
}

describe('ObservabilityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsent.value = 'denied';
    mockConsent.hydrated = false;
  });

  it('tracks the cold launch immediately, without waiting for hydration', () => {
    const renderer = renderProvider();

    // The whole point of dropping the pending state: launch events must not
    // wait on an AsyncStorage read.
    expect(mockTrack).toHaveBeenCalledWith('app_launched', { launch: 'cold' });
    expect(mockStartLifecycleTracking).toHaveBeenCalledTimes(1);

    mockConsent.value = 'granted';
    mockConsent.hydrated = true;
    update(renderer, 'child');
    update(renderer, 'child again');

    expect(mockInstallGlobalErrorHandlers).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockStartLifecycleTracking).toHaveBeenCalledTimes(1);
  });

  it('applies the default consent first, then the stored value', () => {
    // The adapter has to be enabled before anything is tracked, so this effect
    // is declared ahead of the tracking one and runs on the unhydrated default.
    const renderer = renderProvider();
    expect(mockSetConsent).toHaveBeenNthCalledWith(1, 'denied');

    mockConsent.value = 'granted';
    mockConsent.hydrated = true;
    update(renderer, 'child');

    expect(mockSetConsent).toHaveBeenNthCalledWith(2, 'granted');
  });

  it('counts the session regardless of consent', () => {
    // Session counts drive the store review prompt and never leave the device,
    // so they are not gated on consent.
    mockConsent.hydrated = true;
    renderProvider();

    expect(mockBumpSessionCount).toHaveBeenCalledTimes(1);
    expect(mockSetConsent).toHaveBeenCalledWith('denied');
  });

  it('detaches the lifecycle listener on unmount', () => {
    mockConsent.hydrated = true;
    const renderer = renderProvider();

    act(() => renderer.unmount());

    expect(mockStopLifecycleTracking).toHaveBeenCalledTimes(1);
  });
});
