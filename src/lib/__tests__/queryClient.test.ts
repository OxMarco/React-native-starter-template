import { appErrorFromStatus } from '../appError';
import { queryClient } from '../queryClient';
import {
  analytics,
  configureObservability,
  resetObservabilityConfiguration,
} from '@/observability/observability';

describe('query client observability', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    queryClient.clear();
    resetObservabilityConfiguration();
  });

  it('tracks a successful retry without reporting a final failure', async () => {
    const track = jest.fn();
    const captureException = jest.fn();
    configureObservability({
      analytics: { track },
      errors: { captureException },
    });
    analytics.setConsent('granted');

    const queryFn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(appErrorFromStatus(503))
      .mockResolvedValueOnce('ok');

    await expect(
      queryClient.fetchQuery({
        queryKey: ['retry-success'],
        queryFn,
        retry: 1,
        retryDelay: 0,
        meta: { operationName: 'retry_success' },
      })
    ).resolves.toBe('ok');

    expect(track).toHaveBeenCalledWith(
      'query_retry_succeeded',
      expect.objectContaining({ operation: 'retry_success', attempts: 1 })
    );
    expect(track).not.toHaveBeenCalledWith('query_failed', expect.anything());
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports a final server failure after retries are exhausted', async () => {
    const track = jest.fn();
    const captureException = jest.fn();
    configureObservability({
      analytics: { track },
      errors: { captureException },
    });
    analytics.setConsent('granted');

    const error = appErrorFromStatus(503);
    await expect(
      queryClient.fetchQuery({
        queryKey: ['final-failure'],
        queryFn: async () => {
          throw error;
        },
        retry: false,
        meta: { operationName: 'final_failure' },
      })
    ).rejects.toBe(error);

    expect(track).toHaveBeenCalledWith(
      'query_failed',
      expect.objectContaining({ operation: 'final_failure', kind: 'server' })
    );
    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ context: 'query-cache' })
    );
  });
});
