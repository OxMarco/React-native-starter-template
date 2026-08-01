import { errorReporter } from './observability';

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsApi = {
  getGlobalHandler: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

type RejectionTrackingOptions = {
  allRejections: boolean;
  onUnhandled: (id: number, error: unknown) => void;
  onHandled?: (id: number) => void;
};

type RejectionEvent = { reason?: unknown };
type GlobalEventTarget = {
  ErrorUtils?: ErrorUtilsApi;
  HermesInternal?: {
    hasPromise?: () => boolean;
    enablePromiseRejectionTracker?: (options: RejectionTrackingOptions) => void;
  };
  addEventListener?: (type: string, listener: (event: RejectionEvent) => void) => void;
  removeEventListener?: (type: string, listener: (event: RejectionEvent) => void) => void;
};

export function installGlobalErrorHandlers(): () => void {
  const target = globalThis as unknown as GlobalEventTarget;
  const disposers = [installErrorUtilsHandler(target), installRejectionHandlers(target)];

  return () => disposers.forEach((dispose) => dispose());
}

function installErrorUtilsHandler(target: GlobalEventTarget): () => void {
  const errorUtils = target.ErrorUtils;
  if (!errorUtils) return () => undefined;

  // React Native always installs a handler of its own, but requiring one meant
  // that on any host which had not (tests, web, an embedded runtime) this
  // reporter was silently never installed at all.
  const previousHandler = errorUtils.getGlobalHandler();

  const globalHandler: GlobalErrorHandler = (error, isFatal) => {
    errorReporter.captureException(error, {
      context: 'global-error-handler',
      tags: { fatal: String(isFatal === true) },
    });
    previousHandler?.(error, isFatal);
  };

  errorUtils.setGlobalHandler(globalHandler);

  return () => {
    if (errorUtils.getGlobalHandler() === globalHandler && previousHandler) {
      errorUtils.setGlobalHandler(previousHandler);
    }
  };
}

// Unhandled rejections are the most common shape of an uncaught async failure,
// and until this was wired they never reached the reporter on a device.
//
// React Native only tracks them when `__DEV__` is true (see
// Libraries/Core/polyfillPromise.js) — under Hermes through
// `HermesInternal.enablePromiseRejectionTracker`, otherwise through the
// `promise` polyfill. A release build tracks nothing, so rejections were lost
// in exactly the builds worth reporting on. The previous implementation
// listened for a DOM-style `unhandledrejection` event, which React Native
// never dispatches; the optional call resolved to `undefined` and the gap was
// invisible.
//
// Installing only outside `__DEV__` deliberately leaves React Native's dev
// tracker alone: both mechanisms replace the previous registration rather than
// chaining to it, so taking over in development would cost the LogBox warning.
function installRejectionHandlers(target: GlobalEventTarget): () => void {
  const disposeWebListener = installWebRejectionListener(target);
  if (__DEV__) return disposeWebListener;

  let active = true;
  const options: RejectionTrackingOptions = {
    allRejections: true,
    onUnhandled: (_id, reason) => {
      if (active) reportRejection(reason);
    },
    onHandled: () => undefined,
  };

  // Neither tracker can be uninstalled, so the disposer only makes the
  // callback inert. That is enough: this is installed once for the process.
  if (!installHermesRejectionTracker(target, options)) {
    installPolyfillRejectionTracker(options);
  }

  return () => {
    active = false;
    disposeWebListener();
  };
}

function installHermesRejectionTracker(
  target: GlobalEventTarget,
  options: RejectionTrackingOptions
): boolean {
  const hermes = target.HermesInternal;
  if (!hermes?.hasPromise?.() || !hermes.enablePromiseRejectionTracker) return false;

  try {
    hermes.enablePromiseRejectionTracker(options);
    return true;
  } catch {
    return false;
  }
}

function installPolyfillRejectionTracker(options: RejectionTrackingOptions): boolean {
  try {
    // `promise` reaches this project only as a React Native dependency, so the
    // require is guarded rather than imported: a hoisting change has to degrade
    // to "no rejection reporting", never to a bundling failure.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tracking = require('promise/setimmediate/rejection-tracking') as {
      enable: (options: RejectionTrackingOptions) => void;
    };
    tracking.enable(options);
    return true;
  } catch {
    return false;
  }
}

// react-native-web and browser hosts do dispatch the DOM event, and they have
// neither Hermes nor the `promise` polyfill to hook, so this stays everywhere.
function installWebRejectionListener(target: GlobalEventTarget): () => void {
  if (!target.addEventListener) return () => undefined;

  const rejectionHandler = (event: RejectionEvent) => reportRejection(event.reason);
  target.addEventListener('unhandledrejection', rejectionHandler);

  return () => target.removeEventListener?.('unhandledrejection', rejectionHandler);
}

function reportRejection(reason: unknown) {
  errorReporter.captureException(reason, { context: 'unhandled-promise-rejection' });
}
