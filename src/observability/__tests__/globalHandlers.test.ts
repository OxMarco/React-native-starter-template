import { installGlobalErrorHandlers } from '../globalHandlers';
import { configureObservability, resetObservabilityConfiguration } from '../observability';

type Global = typeof globalThis & {
  ErrorUtils?: unknown;
  HermesInternal?: unknown;
  __DEV__: boolean;
};

const globalRef = globalThis as Global;

const captureException = jest.fn();

function useTestReporter() {
  configureObservability({ errors: { captureException } });
}

function withGlobals(values: Record<string, unknown>): () => void {
  const originals = Object.keys(values).map((key) => [key, Reflect.get(globalRef, key)] as const);
  Object.entries(values).forEach(([key, value]) => Reflect.set(globalRef, key, value));

  return () => {
    originals.forEach(([key, value]) => {
      if (value === undefined) Reflect.deleteProperty(globalRef, key);
      else Reflect.set(globalRef, key, value);
    });
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetObservabilityConfiguration();
  useTestReporter();
});

afterEach(() => {
  resetObservabilityConfiguration();
});

describe('installGlobalErrorHandlers', () => {
  it('installs a handler even when the host has no previous one', () => {
    // Regression: requiring a previous handler meant hosts that had not
    // installed one got no reporting at all.
    let handler: ((error: Error, isFatal?: boolean) => void) | undefined;
    const restore = withGlobals({
      ErrorUtils: {
        getGlobalHandler: () => handler,
        setGlobalHandler: (next: typeof handler) => {
          handler = next;
        },
      },
    });

    try {
      installGlobalErrorHandlers();
      expect(handler).toBeDefined();

      const error = new Error('boom');
      handler?.(error, true);

      expect(captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ context: 'global-error-handler' })
      );
    } finally {
      restore();
    }
  });

  it('chains to the previous handler and restores it on dispose', () => {
    const previous = jest.fn();
    let handler: ((error: Error, isFatal?: boolean) => void) | undefined = previous;
    const restore = withGlobals({
      ErrorUtils: {
        getGlobalHandler: () => handler,
        setGlobalHandler: (next: typeof handler) => {
          handler = next;
        },
      },
    });

    try {
      const dispose = installGlobalErrorHandlers();
      const error = new Error('boom');
      handler?.(error, false);

      expect(previous).toHaveBeenCalledWith(error, false);

      dispose();
      expect(handler).toBe(previous);
    } finally {
      restore();
    }
  });

  it('reports unhandled rejections through the Hermes tracker in release builds', () => {
    // React Native only installs a rejection tracker when __DEV__ is true, so a
    // release build reports nothing unless the app installs its own.
    let options: { onUnhandled: (id: number, reason: unknown) => void } | undefined;
    const restore = withGlobals({
      __DEV__: false,
      HermesInternal: {
        hasPromise: () => true,
        enablePromiseRejectionTracker: (next: typeof options) => {
          options = next;
        },
      },
    });

    try {
      installGlobalErrorHandlers();
      expect(options).toBeDefined();

      const reason = new Error('rejected');
      options?.onUnhandled(1, reason);

      expect(captureException).toHaveBeenCalledWith(
        reason,
        expect.objectContaining({ context: 'unhandled-promise-rejection' })
      );
    } finally {
      restore();
    }
  });

  it('leaves the dev tracker alone so LogBox keeps reporting', () => {
    const enablePromiseRejectionTracker = jest.fn();
    const restore = withGlobals({
      __DEV__: true,
      HermesInternal: { hasPromise: () => true, enablePromiseRejectionTracker },
    });

    try {
      installGlobalErrorHandlers();
      expect(enablePromiseRejectionTracker).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('stops reporting rejections once disposed', () => {
    let options: { onUnhandled: (id: number, reason: unknown) => void } | undefined;
    const restore = withGlobals({
      __DEV__: false,
      HermesInternal: {
        hasPromise: () => true,
        enablePromiseRejectionTracker: (next: typeof options) => {
          options = next;
        },
      },
    });

    try {
      const dispose = installGlobalErrorHandlers();
      dispose();
      options?.onUnhandled(1, new Error('late'));

      expect(captureException).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});
