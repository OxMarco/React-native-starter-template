import { requireNativeModule } from 'expo';

// Suppresses a class of unhandled promise rejection that Expo's own fetch
// produces on abort.
//
// `expo/fetch` is installed as the global `fetch` by Expo's winter runtime. Its
// `ReadableStream` cancel callback calls the native `NativeResponse.cancelStreaming`
// without keeping a handler on the returned promise
// (expo/src/winter/fetch/FetchResponse.ts). When an abort races response
// teardown, the native SharedObject has already been released, the call rejects
// with "doesn't contain valid id", and — because nothing is awaiting it — the
// rejection escapes as an unhandled rejection.
//
// This matters here specifically because aborting is on the hot path: the API
// client aborts on timeout, React Query passes an abort signal and fires it on
// unmount, and the store-version lookup has a timeout of its own. Combined with
// `installGlobalErrorHandlers`, which reports unhandled rejections in release
// builds, that turns an Expo implementation detail into a steady stream of
// crash reports about a cancellation that already succeeded.
//
// There is nothing left to cancel when this rejects, so the fix is to attach the
// handler Expo omits. Best-effort by design: if Expo renames the module or the
// class the patch simply does not apply and the rejections reappear in the error
// reporter — which is the signal to revisit rather than a silent regression.
//
// Remove once expo/fetch handles this itself (expo/expo#34772).

type Patchable = {
  prototype?: { cancelStreaming?: (...args: unknown[]) => unknown };
};

let installed = false;

/**
 * Applies the guard. Call once, before the first request. Returns true when the
 * patch was applied, false when the native module or method was not found —
 * which is the normal case on web and under test.
 */
export function installExpoFetchCancelGuard(): boolean {
  if (installed) return true;

  try {
    const nativeResponse = (
      requireNativeModule('ExpoFetchModule') as { NativeResponse?: Patchable }
    ).NativeResponse;
    const prototype = nativeResponse?.prototype;
    if (!prototype) return false;
    const original = prototype.cancelStreaming;
    if (typeof original !== 'function') return false;

    prototype.cancelStreaming = function cancelStreamingGuarded(this: unknown, ...args: unknown[]) {
      try {
        const result = original.apply(this, args);
        // The only change: observe the rejection. The result is still returned
        // unchanged, so any caller that does await it sees what it always did.
        void Promise.resolve(result).catch(() => undefined);
        return result;
      } catch {
        return undefined;
      }
    };

    installed = true;
    return true;
  } catch {
    // Native module unavailable — web, tests, or a runtime without it.
    return false;
  }
}

export function resetExpoFetchCancelGuardForTests(): void {
  installed = false;
}
