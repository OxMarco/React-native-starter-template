import {
  analytics,
  configureObservability,
  errorReporter,
  resetObservabilityConfiguration,
  sanitizeProperties,
} from '../observability';

describe('observability', () => {
  afterEach(() => {
    resetObservabilityConfiguration();
  });

  it('does not send analytics without explicit consent', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });
    analytics.setConsent('undecided');

    analytics.track('app_launched', { launch: 'cold' });
    expect(track).not.toHaveBeenCalled();

    analytics.setConsent('granted');
    analytics.track('app_launched', { launch: 'cold' });
    expect(track).toHaveBeenCalledWith(
      'app_launched',
      expect.objectContaining({ launch: 'cold', platform: expect.any(String) })
    );
  });

  it('buffers only the consent-hydration window and discards it when consent is absent', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });

    analytics.screen('Welcome');
    analytics.setConsent('denied');
    analytics.setConsent('granted');

    expect(track).not.toHaveBeenCalled();
  });

  it('flushes the consent-hydration window when stored consent is granted', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });

    analytics.screen('Welcome');
    analytics.setConsent('granted');

    expect(track).toHaveBeenCalledWith(
      'screen_viewed',
      expect.objectContaining({ screen: 'Welcome' })
    );
  });

  it('resets the analytics identity when consent is withdrawn', () => {
    const reset = jest.fn();
    configureObservability({ analytics: { track: jest.fn(), reset } });

    analytics.setConsent('granted');
    analytics.setConsent('denied');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('redacts sensitive telemetry properties', () => {
    expect(sanitizeProperties({ auth_token: 'secret', operation: 'list_items', count: 2 })).toEqual(
      { auth_token: '[REDACTED]', operation: 'list_items', count: 2 }
    );
  });

  it('keeps adapter failures from changing application behavior', () => {
    configureObservability({
      analytics: {
        track: () => {
          throw new Error('analytics unavailable');
        },
      },
      errors: {
        captureException: () => {
          throw new Error('reporter unavailable');
        },
      },
    });
    analytics.setConsent('granted');

    expect(() => analytics.track('app_launched', { launch: 'cold' })).not.toThrow();
    expect(() => errorReporter.captureException(new Error('app failure'))).not.toThrow();
  });
});
