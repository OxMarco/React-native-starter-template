import {
  installExpoFetchCancelGuard,
  resetExpoFetchCancelGuardForTests,
} from '../expoFetchCancelGuard';

const mockRequireNativeModule = jest.fn();

jest.mock('expo', () => ({
  requireNativeModule: (name: string) => mockRequireNativeModule(name),
}));

type CancelStreaming = (...args: unknown[]) => unknown;

function nativeModuleWith(cancelStreaming: CancelStreaming) {
  return { NativeResponse: { prototype: { cancelStreaming } } };
}

describe('installExpoFetchCancelGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetExpoFetchCancelGuardForTests();
  });

  it('observes the rejection Expo leaves unhandled', async () => {
    const rejection = Promise.reject(new Error("doesn't contain valid id"));
    const module = nativeModuleWith(() => rejection);
    mockRequireNativeModule.mockReturnValue(module);
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    expect(installExpoFetchCancelGuard()).toBe(true);
    module.NativeResponse.prototype.cancelStreaming();
    // Let the microtask queue drain so an unobserved rejection would surface.
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });

  it('returns the original result unchanged', () => {
    const result = Promise.resolve('cancelled');
    const module = nativeModuleWith(() => result);
    mockRequireNativeModule.mockReturnValue(module);

    installExpoFetchCancelGuard();

    // A caller that does await the promise must see exactly what it saw before
    // — the guard only attaches a handler, it does not replace the value.
    expect(module.NativeResponse.prototype.cancelStreaming()).toBe(result);
  });

  it('forwards the receiver and arguments to the original', () => {
    const original = jest.fn(function (this: unknown) {
      return this;
    });
    const module = nativeModuleWith(original);
    mockRequireNativeModule.mockReturnValue(module);

    installExpoFetchCancelGuard();
    const receiver = { id: 1 };
    module.NativeResponse.prototype.cancelStreaming.call(receiver, 'a', 'b');

    expect(original).toHaveBeenCalledWith('a', 'b');
    expect(original.mock.instances[0]).toBe(receiver);
  });

  it('swallows a synchronous throw from the released native object', () => {
    const module = nativeModuleWith(() => {
      throw new Error('SharedObject released');
    });
    mockRequireNativeModule.mockReturnValue(module);

    installExpoFetchCancelGuard();

    expect(() => module.NativeResponse.prototype.cancelStreaming()).not.toThrow();
  });

  it.each([
    ['the native module is absent', () => new Error('module not found')],
    ['the class is missing', () => ({})],
    ['the method is missing', () => ({ NativeResponse: { prototype: {} } })],
  ])('degrades to a no-op when %s', (_label, build) => {
    const value = build();
    if (value instanceof Error) mockRequireNativeModule.mockImplementation(() => throwing(value));
    else mockRequireNativeModule.mockReturnValue(value);

    // Reporting false rather than throwing is what makes this safe to call on
    // web and under test, where there is no native module to patch.
    expect(installExpoFetchCancelGuard()).toBe(false);
  });

  it('patches only once', () => {
    const original = jest.fn();
    const module = nativeModuleWith(original);
    mockRequireNativeModule.mockReturnValue(module);

    installExpoFetchCancelGuard();
    const patched = module.NativeResponse.prototype.cancelStreaming;
    installExpoFetchCancelGuard();

    // Re-wrapping on every call would nest the guard once per invocation.
    expect(module.NativeResponse.prototype.cancelStreaming).toBe(patched);
  });
});

function throwing(error: Error): never {
  throw error;
}
