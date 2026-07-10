import { errorReporter } from './observability';

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsApi = {
  getGlobalHandler: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

type RejectionEvent = { reason?: unknown };
type GlobalEventTarget = {
  ErrorUtils?: ErrorUtilsApi;
  addEventListener?: (type: string, listener: (event: RejectionEvent) => void) => void;
  removeEventListener?: (type: string, listener: (event: RejectionEvent) => void) => void;
};

export function installGlobalErrorHandlers(): () => void {
  const target = globalThis as unknown as GlobalEventTarget;
  const errorUtils = target.ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler();

  const globalHandler: GlobalErrorHandler = (error, isFatal) => {
    errorReporter.captureException(error, {
      context: 'global-error-handler',
      tags: { fatal: String(isFatal === true) },
    });
    previousHandler?.(error, isFatal);
  };

  if (errorUtils && previousHandler) errorUtils.setGlobalHandler(globalHandler);

  const rejectionHandler = (event: RejectionEvent) => {
    errorReporter.captureException(event.reason, { context: 'unhandled-promise-rejection' });
  };
  target.addEventListener?.('unhandledrejection', rejectionHandler);

  return () => {
    if (errorUtils?.getGlobalHandler() === globalHandler && previousHandler) {
      errorUtils.setGlobalHandler(previousHandler);
    }
    target.removeEventListener?.('unhandledrejection', rejectionHandler);
  };
}
