import type { ReactNode } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import AppProviders from '../AppProviders';

const mockPersistProps: { current: PersistProviderProps | null } = { current: null };
const mockResumeOfflineMutations = jest.fn(async (_client: unknown) => undefined);
const mockCaptureException = jest.fn();
const mockTrack = jest.fn();

type PersistProviderProps = {
  children: ReactNode;
  client: unknown;
  persistOptions: Record<string, unknown>;
  onSuccess: () => void;
  onError: () => void;
};

jest.mock('@tanstack/react-query-persist-client', () => ({
  PersistQueryClientProvider: (props: PersistProviderProps) => {
    mockPersistProps.current = props;
    return props.children;
  },
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@/lib/queryClient', () => ({
  queryClient: { test: 'query-client' },
  QueryLifecycle: () => null,
}));

jest.mock('@/lib/offlineMutations', () => ({
  resumeOfflineMutations: (client: unknown) => mockResumeOfflineMutations(client),
}));

jest.mock('@/lib/queryPersistence', () => ({
  QUERY_CACHE_BUSTER: 'test-buster',
  queryPersister: { test: 'query-persister' },
  shouldPersistQuery: jest.fn(),
  shouldPersistMutation: jest.fn(),
}));

jest.mock('@/observability/observability', () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
  errorReporter: {
    captureException: (...args: unknown[]) => mockCaptureException(...args),
  },
}));

jest.mock('../ObservabilityProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('../ThemeProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

describe('AppProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistProps.current = null;
  });

  it('wires the split persister and deny-by-default dehydration filters', () => {
    act(() => {
      TestRenderer.create(
        <AppProviders>
          <Text>child</Text>
        </AppProviders>
      );
    });

    expect(mockPersistProps.current?.client).toEqual({ test: 'query-client' });
    expect(mockPersistProps.current?.persistOptions).toEqual({
      persister: { test: 'query-persister' },
      buster: 'test-buster',
      dehydrateOptions: {
        shouldDehydrateQuery: expect.any(Function),
        shouldDehydrateMutation: expect.any(Function),
      },
    });
  });

  it('reports a failed offline replay with actionable context', async () => {
    const error = new Error('replay failed');
    mockResumeOfflineMutations.mockRejectedValueOnce(error);
    act(() => {
      TestRenderer.create(
        <AppProviders>
          <Text>child</Text>
        </AppProviders>
      );
    });

    await act(async () => {
      mockPersistProps.current?.onSuccess();
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(mockResumeOfflineMutations).toHaveBeenCalledWith({ test: 'query-client' });
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      context: 'offline-mutation-resume',
    });
  });

  it('reports a cache restoration failure', () => {
    act(() => {
      TestRenderer.create(
        <AppProviders>
          <Text>child</Text>
        </AppProviders>
      );
    });

    act(() => mockPersistProps.current?.onError());

    expect(mockTrack).toHaveBeenCalledWith('cache_restore_failed', { kind: 'unknown' });
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
      context: 'query-cache-restore',
    });
  });
});
