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

  it('sends launch events on the default without waiting for stored consent', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });

    // No pending state: an event captured before `setConsent` runs is sent on
    // the documented default rather than held until AsyncStorage answers.
    analytics.track('app_launched', { launch: 'cold' });

    expect(track).toHaveBeenCalledWith(
      'app_launched',
      expect.objectContaining({ launch: 'cold', platform: expect.any(String) })
    );
  });

  it('stops sending as soon as a stored withdrawal resolves', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });

    analytics.screen('Welcome');
    analytics.setConsent('denied');
    analytics.screen('Home');

    // The pre-hydration event is gone from the facade's perspective — it was
    // already handed to the adapter. Only what comes after the withdrawal is
    // guaranteed to stop.
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      'screen_viewed',
      expect.objectContaining({ screen: 'Welcome' })
    );
  });

  it('disables the adapter itself when consent is withdrawn', () => {
    const setEnabled = jest.fn();
    configureObservability({ analytics: { track: jest.fn(), setEnabled } });

    analytics.setConsent('granted');
    analytics.setConsent('denied');

    expect(setEnabled).toHaveBeenLastCalledWith(false);
  });

  it('resumes sending when a withdrawal is reversed', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });

    analytics.setConsent('denied');
    analytics.screen('Welcome');
    expect(track).not.toHaveBeenCalled();

    analytics.setConsent('granted');
    analytics.screen('Home');
    expect(track).toHaveBeenCalledTimes(1);
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
